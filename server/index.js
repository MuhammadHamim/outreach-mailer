import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { convert } from 'html-to-text';
import * as db from './db.js';
import * as scheduler from './scheduler.js';
import { computeTimes } from './schedule.js';
import * as resumes from './resumes.js';
import * as inbox from './inbox.js';
import { sendEmail, smtpCheck, mailMode, getAccount, saveAccount, selectAccount, deleteAccount, loadAccount, loadDoc, dropFromCache, patchAccount, setRotate } from './mailer.js';
import { PROVIDERS } from './providers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '40mb' }));
app.use(cookieParser());

const PASSWORD = process.env.APP_PASSWORD;
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
if (!PASSWORD) console.log('[auth] No APP_PASSWORD set: running in single-user local mode (no login, reachable from this computer only).');
if (!process.env.SESSION_SECRET) console.warn('[auth] SESSION_SECRET not set - sessions reset on every restart.');

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error(e); res.status(400).json({ error: e.message || 'Error' }); });
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

// ---------- auth ----------
const attempts = new Map();
app.post('/api/login', wrap(async (req, res) => {
  const ip = req.ip, rec = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - rec.t > 15 * 60000) { rec.n = 0; rec.t = Date.now(); }
  if (rec.n >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!PASSWORD || !safeEq(String(req.body?.password || ''), PASSWORD)) {
    attempts.set(ip, { ...rec, n: rec.n + 1 });
    return res.status(401).json({ error: 'Wrong password' });
  }
  attempts.delete(ip);
  const token = jwt.sign({ u: 'owner' }, SECRET, { expiresIn: '14d' });
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 14 * 86400000 });
  res.json({ ok: true });
}));
app.post('/api/logout', (req, res) => { res.clearCookie('session'); res.json({ ok: true }); });

app.use('/api', (req, res, next) => {
  if (!PASSWORD) return next();
  try { jwt.verify(req.cookies.session || '', SECRET); next(); } catch { res.status(401).json({ error: 'Not signed in' }); }
});
app.get('/api/me', (req, res) => res.json({ ok: true, auth: !!PASSWORD }));

// ---------- overview & settings ----------
app.get('/api/overview', wrap(async (req, res) => {
  const emails = (await db.list('emails')).filter((e) => e.kind !== 'reply');
  const counts = {};
  for (const e of emails) counts[e.status] = (counts[e.status] || 0) + 1;
  const upcoming = emails.filter((e) => e.status === 'scheduled').sort((a, b) => a.sendAt - b.sendAt).slice(0, 6)
    .map(({ id, to, toName, subject, sendAt }) => ({ id, to, toName, subject, sendAt }));
  const recent = emails.filter((e) => e.sentAt).sort((a, b) => b.sentAt - a.sentAt).slice(0, 5)
    .map(({ id, to, toName, sentAt }) => ({ id, to, toName, sentAt }));
  const acc = getAccount(), docs = (await db.list('documents')).length, days = scheduler.getSettings().followUpDays;
  const kids = new Map(); for (const e of emails) if (e.parentId) (kids.get(e.parentId) || kids.set(e.parentId, []).get(e.parentId)).push(e);
  const followUpDue = emails.filter((e) => e.status === 'sent' && !e.parentId && !e.replyCount && !e.noFollowUp && !(kids.get(e.id) || []).some((k) => ['draft', 'scheduled', 'sending'].includes(k.status)) && Date.now() - Math.max(e.sentAt || 0, ...(kids.get(e.id) || []).map((k) => k.sentAt || 0)) > days * 86400000).length;
  res.json({ counts, total: emails.length, upcoming, recent, docs, followUpDue, accountReady: !!(acc.email && acc.hasCode), unreadReplies: emails.reduce((n, e) => n + (e.unread || 0), 0), inbox: inbox.status, todaySent: scheduler.todaySent(), settings: scheduler.getSettings(),
    mailMode, sender: getAccount().email, storage: db.usingFirestore ? 'firestore' : 'local', desktop: !!process.env.OUTREACH_DESKTOP, now: Date.now() });
}));
app.get('/api/settings', (req, res) => res.json(scheduler.getSettings()));
app.put('/api/settings', wrap(async (req, res) => res.json(await scheduler.saveSettings(req.body || {}))));
app.get('/api/providers', (req, res) => res.json(PROVIDERS));
app.get('/api/account', (req, res) => res.json({ ...getAccount(), editable: !db.usingFirestore }));
app.put('/api/account', wrap(async (req, res) => {
  if (db.usingFirestore) throw new Error('On a hosted deployment set MAIL_PROVIDER / MAIL_EMAIL / MAIL_PASSWORD (or QQ_EMAIL / QQ_AUTH_CODE) as environment variables instead');
  await saveAccount(req.body || {}); res.json(getAccount());
}));
app.post('/api/account/select', wrap(async (req,res) => { await selectAccount(req.body.id); res.json(getAccount()); }));
app.delete('/api/account/:id', wrap(async (req,res) => { await deleteAccount(req.params.id); res.json(getAccount()); }));
app.get('/api/smtp-check', wrap(async (req, res) => res.json(await smtpCheck(req.query.id))));
app.put('/api/account/:id/settings', wrap(async (req, res) => { await patchAccount(req.params.id, req.body || {}); res.json(getAccount()); }));
app.post('/api/account/rotate', wrap(async (req, res) => { await setRotate(req.body?.on); res.json(getAccount()); }));

// ---------- documents (CV, transcript...) ----------
const CHUNK = 700_000; // base64 chars per Firestore doc (limit is ~1 MB)
app.get('/api/documents', wrap(async (req, res) => res.json((await db.list('documents')).sort((a, b) => a.createdAt - b.createdAt))));
app.put('/api/documents', express.raw({ type: '*/*', limit: '15mb' }), wrap(async (req, res) => {
  const name = String(req.query.name || '').replace(/[\\/]/g, '_').trim();
  if (!name || !req.body?.length) throw new Error('Missing file');
  const id = db.newId(), b64 = req.body.toString('base64'), chunks = Math.ceil(b64.length / CHUNK);
  await db.setMany('docchunks', Array.from({ length: chunks }, (_, i) => [`${id}_${i}`, { data: b64.slice(i * CHUNK, (i + 1) * CHUNK) }]));
  const meta = { name, size: req.body.length, mime: req.get('x-file-type') || 'application/octet-stream', chunks, createdAt: Date.now() };
  await db.set('documents', id, meta);
  res.json({ id, ...meta });
}));
app.get('/api/documents/:id/download', wrap(async (req, res) => {
  const { meta, buffer } = await loadDoc(req.params.id);
  res.set('Content-Type', meta.mime).set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`).send(buffer);
}));
app.delete('/api/documents/:id', wrap(async (req, res) => {
  const meta = await db.get('documents', req.params.id);
  if (!meta) throw new Error('Not found');
  await db.removeMany('docchunks', Array.from({ length: meta.chunks }, (_, i) => `${meta.id}_${i}`));
  await db.remove('documents', meta.id);
  dropFromCache(meta.id);
  // detach from emails that still reference it
  const touched = (await db.list('emails')).filter((e) => e.attachments?.includes(meta.id));
  await db.updateMany('emails', touched.map((e) => [e.id, { attachments: e.attachments.filter((a) => a !== meta.id) }]));
  res.json({ ok: true, detached: touched.length });
}));

// ---------- resumes (files in <data folder>/Resume) ----------
app.get('/api/resumes', wrap(async (req, res) => res.json({ dir: resumes.resumeDir(), items: resumes.list() })));
app.get('/api/resumes/:id', wrap(async (req, res) => { const r = resumes.get(req.params.id); if (!r) return res.status(404).json({ error: 'Resume not found' }); res.json(r); }));
app.put('/api/resumes/:id', wrap(async (req, res) => res.json(resumes.save(req.params.id, req.body))));
app.delete('/api/resumes/:id', wrap(async (req, res) => { resumes.remove(req.params.id); res.json({ ok: true }); }));

// ---------- batches ----------
app.get('/api/batches', wrap(async (req, res) => res.json((await db.list('batches')).sort((a, b) => b.createdAt - a.createdAt))));
app.post('/api/batches', wrap(async (req, res) => {
  const { name, attachments = [], emails = [] } = req.body || {};
  if (!name?.trim()) throw new Error('Batch name is required');
  const rows = emails.filter((e) => /^\S+@\S+\.\S+$/.test(String(e.to || '').trim()) && e.body?.trim() && e.subject?.trim());
  if (!rows.length) throw new Error('No valid rows (need email, subject and body)');
  const batchId = db.newId(), createdAt = Date.now();
  await db.set('batches', batchId, { name: name.trim(), createdAt, count: rows.length });
  await db.setMany('emails', rows.map((r, i) => [db.newId(), {
    batchId, batchName: name.trim(), to: r.to.trim(), toName: r.toName || '', subject: r.subject.trim(), body: r.body,
    attachments, tags: [], status: 'draft', sendAt: null, sentAt: null, error: null, order: i, createdAt,
  }]));
  res.json({ batchId, created: rows.length, skipped: emails.length - rows.length });
}));
app.delete('/api/batches/:id', wrap(async (req, res) => {
  const ids = (await db.listWhere('emails', 'batchId', req.params.id)).filter((e) => e.status !== 'sending').map((e) => e.id);
  await db.removeMany('emails', ids); await removeReplies(ids); await db.remove('batches', req.params.id); await scheduler.reload();
  res.json({ deleted: ids.length });
}));

// ---------- emails ----------
const EDITABLE = ['to', 'toName', 'subject', 'body', 'attachments'];
const pick = (src) => Object.fromEntries(EDITABLE.filter((k) => k in src).map((k) => [k, src[k]]));
const isLocked = (e) => ['sent', 'replied', 'sending'].includes(e.status);
const normTags = (t) => [...new Set((Array.isArray(t) ? t : []).map((x) => String(x).trim().slice(0, 30)).filter(Boolean))].slice(0, 12);

app.get('/api/emails', wrap(async (req, res) => {
  res.json((await db.list('emails')).sort((a, b) => a.createdAt - b.createdAt || a.order - b.order));
}));

const normEmail = (s) => String(s || '').trim().toLowerCase();

// Which of these addresses are already in the app, and what was sent to them?
app.post('/api/emails/check-duplicates', wrap(async (req, res) => {
  const wanted = new Set((req.body.addresses || []).map(normEmail).filter(Boolean));
  const out = {};
  for (const e of await db.list('emails')) {
    const key = normEmail(e.to);
    if (!wanted.has(key)) continue;
    (out[key] ||= []).push({
      id: e.id, status: e.status, kind: e.kind || 'original',
      subject: e.subject, body: e.body, batchName: e.batchName || '',
      sentAt: e.sentAt || null, createdAt: e.createdAt || null,
      attachments: Array.isArray(e.attachments) ? e.attachments.map((a) => a.filename || a.name || 'file') : [],
    });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => (b.sentAt || b.createdAt || 0) - (a.sentAt || a.createdAt || 0));
  res.json(out);
}));

const cleanHtml = (h) => sanitizeHtml(String(h || ''), {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'span', 'u', 's', 'mark', 'h2', 'h3', 'table', 'tbody', 'tr', 'td']),
  allowedAttributes: { '*': ['style', 'href', 'src', 'alt', 'width', 'height', 'target', 'rel', 'align', 'valign', 'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan', 'bgcolor'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
});
const htmlToPlain = (h) => convert(h, { wordwrap: false, selectors: [{ selector: 'img', format: 'skip' }, { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }] });

app.post('/api/emails', wrap(async (req, res) => {
  const { to, toName = '', subject, body, html, attachments = [], tags = [], mode = 'draft', sendAt } = req.body || {};
  const addr = String(to || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(addr)) throw new Error('Enter a valid recipient email address');
  if (!String(subject || '').trim()) throw new Error('Subject is required');
  const safeHtml = html ? cleanHtml(html) : '';
  const text = safeHtml ? htmlToPlain(safeHtml) : String(body || '');
  if (!text.trim()) throw new Error('Write a message first');
  const now = Date.now(), id = db.newId();
  let plan = { status: 'draft', sendAt: null, windowEnd: null };
  if (mode === 'now') plan = { status: 'scheduled', sendAt: now, windowEnd: now + scheduler.graceMs() };
  else if (mode === 'schedule') {
    const t = Number(sendAt);
    if (!t || t < now - 60000) throw new Error('Pick a time in the future');
    plan = { status: 'scheduled', sendAt: t, windowEnd: t + scheduler.graceMs() };
  }
  await db.set('emails', id, {
    batchId: null, batchName: 'Manual', to: addr, toName: String(toName).trim(),
    subject: String(subject).trim(), body: text, html: safeHtml,
    attachments: Array.isArray(attachments) ? attachments : [], tags: normTags(tags),
    ...plan, sentAt: null, error: null, order: 0, createdAt: now,
  });
  if (plan.status === 'scheduled') await scheduler.reload();
  res.json({ id, status: plan.status });
}));

// ---- Signatures (new) ----
app.get('/api/signatures', wrap(async (req, res) => res.json((await db.list('signatures')).sort((a, b) => a.createdAt - b.createdAt))));
app.post('/api/signatures', wrap(async (req, res) => {
  const { id: given, name, templateId, fields = {}, html } = req.body || {};
  if (!String(name || '').trim() || !String(html || '').trim()) throw new Error('Signature needs a name and content');
  const id = given || db.newId(), old = given ? await db.get('signatures', given) : null;
  const doc = { name: String(name).trim().slice(0, 80), templateId: String(templateId || ''), fields, html: cleanHtml(html), createdAt: old?.createdAt || Date.now() };
  await db.set('signatures', id, doc);
  res.json({ id, ...doc });
}));
app.delete('/api/signatures/:id', wrap(async (req, res) => { await db.remove('signatures', req.params.id); res.json({ ok: true }); }));

app.patch('/api/emails/:id', wrap(async (req, res) => {
  const e = await db.get('emails', req.params.id); if (!e) throw new Error('Not found');
  const patch = {};
  if (req.body.status === 'replied' && e.status === 'sent') patch.status = 'replied';
  else if (req.body.status === 'sent' && e.status === 'replied') patch.status = 'sent';
  else if (isLocked(e) && Object.keys(pick(req.body)).length) throw new Error('This email was already sent and can no longer be edited');
  Object.assign(patch, isLocked(e) ? {} : pick(req.body));
  if (patch.body !== undefined) patch.html = ''; // a plain-text edit replaces the rich version
  if (patch.to && !/^\S+@\S+\.\S+$/.test(patch.to)) throw new Error('Invalid email address');
  if ('tags' in req.body) patch.tags = normTags(req.body.tags);
  if ('noFollowUp' in req.body) patch.noFollowUp = !!req.body.noFollowUp;
  await db.update('emails', e.id, patch);
  res.json(await db.get('emails', e.id));
}));
app.post('/api/emails/bulk', wrap(async (req, res) => {
  const ids = new Set(req.body.ids || []), patch = pick(req.body.patch || {});
  delete patch.to; delete patch.toName; // never bulk-change recipients
  const rows = (await db.list('emails')).filter((e) => ids.has(e.id) && !isLocked(e));
  await db.updateMany('emails', rows.map((e) => [e.id, patch]));
  res.json({ updated: rows.length });
}));
app.post('/api/emails/bulk-tags', wrap(async (req, res) => {
  const ids = new Set(req.body.ids || []), add = normTags(req.body.add), rem = new Set(normTags(req.body.remove));
  const rows = (await db.list('emails')).filter((e) => ids.has(e.id));
  await db.updateMany('emails', rows.map((e) => [e.id, { tags: normTags([...(e.tags || []).filter((t) => !rem.has(t)), ...add]) }]));
  res.json({ updated: rows.length });
}));
app.post('/api/emails/bulk-delete', wrap(async (req, res) => {
  const ids = new Set(req.body.ids || []);
  const rows = (await db.list('emails')).filter((e) => ids.has(e.id) && e.status !== 'sending');
  await db.removeMany('emails', rows.map((e) => e.id)); await removeReplies(rows.map((e) => e.id)); await scheduler.reload();
  res.json({ deleted: rows.length });
}));
const removeReplies = async (emailIds) => { const set = new Set(emailIds); const r = (await db.list('replies')).filter((x) => set.has(x.emailId)); await db.removeMany('replies', r.map((x) => x.id)); };

// ----- conversation: our email, follow-ups, replies from the mailbox -----
app.get('/api/emails/:id/thread', wrap(async (req, res) => {
  const e = await db.get('emails', req.params.id); if (!e) throw new Error('Not found');
  const kids = (await db.list('emails')).filter((x) => x.parentId === e.id);
  const replies = await db.listWhere('replies', 'emailId', e.id);
  const items = [
    { type: 'out', id: e.id, kind: 'original', at: e.sentAt || e.sendAt || e.createdAt, status: e.status, subject: e.subject, text: e.body, attachments: e.attachments?.length || 0 },
    ...kids.map((c) => ({ type: 'out', id: c.id, kind: c.kind || 'followup', at: c.sentAt || c.sendAt || c.createdAt, status: c.status, subject: c.subject, text: c.body, error: c.error })),
    ...replies.map((r) => ({ type: 'in', id: r.id, at: r.date, from: r.from, fromName: r.fromName, subject: r.subject, text: r.text, quoted: r.quoted, auto: r.auto, attachments: r.attachments || [], read: r.read })),
  ].sort((a, b) => a.at - b.at);
  res.json({ email: e, items });
}));
app.post('/api/emails/:id/read', wrap(async (req, res) => {
  const e = await db.get('emails', req.params.id); if (!e) throw new Error('Not found');
  const rs = (await db.listWhere('replies', 'emailId', e.id)).filter((r) => !r.read);
  await db.updateMany('replies', rs.map((r) => [r.id, { read: true }]));
  await db.update('emails', e.id, { unread: 0 }); res.json({ ok: true });
}));
app.post('/api/emails/:id/reply', wrap(async (req, res) => {
  const e = await db.get('emails', req.params.id); if (!e) throw new Error('Not found');
  const text = String(req.body.text || '').trim(); if (!text) throw new Error('Write your reply first');
  if (!['sent', 'replied'].includes(e.status)) throw new Error('You can reply once the email has been sent');
  const kids = (await db.list('emails')).filter((x) => x.parentId === e.id && x.messageId), replies = (await db.listWhere('replies', 'emailId', e.id)).sort((a, b) => a.date - b.date);
  const lastIn = replies.filter((r) => !r.auto).at(-1);
  const refs = [e.messageId, ...kids.map((k) => k.messageId), ...replies.map((r) => r.messageId)].filter(Boolean);
  const subject = /^re:/i.test(e.subject) ? e.subject : `Re: ${e.subject}`, to = lastIn?.from || e.to, attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  const messageId = await sendEmail({ to, subject, body: text, attachments, inReplyTo: lastIn?.messageId || refs.at(-1), references: refs.join(' '), accountId: e.accountId });
  await db.set('emails', db.newId(), { batchId: e.batchId, batchName: e.batchName, to, toName: e.toName, subject, body: text, attachments, status: 'sent', kind: 'reply', accountId: e.accountId || null, parentId: e.id, sentAt: Date.now(), messageId, tags: [], order: 0, createdAt: Date.now() });
  res.json({ ok: true });
}));
// create follow-up drafts (as replies in the same conversation) for sent emails that got no answer
app.post('/api/followups', wrap(async (req, res) => {
  const { ids = [], body = '', subject = '', attachments = [], quote = true } = req.body || {};
  if (!String(body).trim()) throw new Error('Write the follow-up message first');
  const set = new Set(ids), all = await db.list('emails');
  const rows = all.filter((e) => set.has(e.id) && e.status === 'sent' && !e.replyCount && e.kind !== 'reply');
  if (!rows.length) throw new Error('Follow-ups are for sent emails that have no reply yet');
  const me = getAccount().name || 'me', now = Date.now(), made = [];
  for (const r of rows) {
    const kids = all.filter((x) => x.parentId === r.id && x.messageId).sort((a, b) => a.sentAt - b.sentAt);
    const refs = [r.messageId, ...kids.map((k) => k.messageId)].filter(Boolean);
    let text = String(body).replace(/\{\{\s*name\s*\}\}/gi, r.toName || '').replace(/\{\{\s*subject\s*\}\}/gi, r.subject);
    if (quote) text += `\n\n\nOn ${new Date(r.sentAt).toDateString()}, ${me} wrote:\n` + String(r.body || '').split('\n').map((l) => `> ${l}`).join('\n');
    const sub = String(subject).trim() || (/^re:/i.test(r.subject) ? r.subject : `Re: ${r.subject}`);
    const id = db.newId(); made.push(id);
    await db.set('emails', id, { batchId: r.batchId, batchName: r.batchName, to: r.to, toName: r.toName, subject: sub, body: text, attachments, status: 'draft', kind: 'followup', parentId: r.id, inReplyTo: refs.at(-1), references: refs.join(' '), tags: ['Follow-up'], sendAt: null, sentAt: null, error: null, order: 0, createdAt: now });
  }
  res.json({ created: made.length, skipped: ids.length - rows.length });
}));
app.post('/api/inbox/sync', wrap(async (req, res) => res.json(await inbox.syncReplies())));
app.get('/api/inbox/status', (req, res) => res.json(inbox.status));

// emails whose scheduled window passed while the app was off
app.get('/api/missed', wrap(async (req, res) => {
  const rows = (await db.listWhere('emails', 'status', 'missed')).filter((e) => e.kind !== 'reply');
  const groups = new Map();
  for (const e of rows) { const k = `${e.batchId || ''}|${Math.floor(e.sendAt / 86400000)}`; const g = groups.get(k) || { batch: e.batchName || 'Emails', ids: [], from: e.sendAt, until: e.windowEnd || e.sendAt }; g.ids.push(e.id); g.from = Math.min(g.from, e.sendAt); g.until = Math.max(g.until, e.windowEnd || e.sendAt); groups.set(k, g); }
  res.json({ count: rows.length, groups: [...groups.values()].map((g) => ({ batch: g.batch, count: g.ids.length, from: g.from, until: g.until, ids: g.ids })), tz: scheduler.getSettings().tz });
}));
app.post('/api/missed/resolve', wrap(async (req, res) => {
  const set = req.body.ids ? new Set(req.body.ids) : null, now = Date.now();
  const rows = (await db.listWhere('emails', 'status', 'missed')).filter((e) => !set || set.has(e.id));
  const patch = req.body.action === 'now' ? { status: 'scheduled', sendAt: now, windowEnd: now + scheduler.graceMs() } : { status: 'draft', sendAt: null, windowEnd: null };
  await db.updateMany('emails', rows.map((e) => [e.id, patch])); await scheduler.reload();
  res.json({ count: rows.length });
}));

app.post('/api/emails/:id/test', wrap(async (req, res) => {
  const e = await db.get('emails', req.params.id); if (!e) throw new Error('Not found');
  const me = getAccount().email; if (!me) throw new Error('Set up your email account in Settings first');
  await sendEmail({ ...e, to: me, subject: `[TEST] ${e.subject}` });
  res.json({ ok: true, sentTo: me });
}));

// ---------- scheduling ----------
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
app.post('/api/schedule', wrap(async (req, res) => {
  const { ids = [], preview, shuffle: doShuffle, ...opts } = req.body || {};
  const idSet = new Set(ids);
  let rows = (await db.list('emails')).filter((e) => idSet.has(e.id) && ['draft', 'scheduled', 'failed', 'missed'].includes(e.status) && e.kind !== 'reply')
    .sort((a, b) => a.createdAt - b.createdAt || a.order - b.order);
  if (!rows.length) throw new Error('Nothing to schedule (only draft, scheduled or failed emails can be scheduled)');
  if (doShuffle) rows = shuffle(rows);
  const tz = opts.tz || scheduler.getSettings().tz;
  const times = computeTimes({ ...opts, tz, n: rows.length, graceMs: scheduler.graceMs() });
  const plan = rows.map((r, i) => ({ id: r.id, to: r.to, toName: r.toName, sendAt: times[i].at, until: times[i].until }));
  if (preview) return res.json({ count: plan.length, plan: plan.slice(0, 12), first: times[0].at, last: times.at(-1).at });
  await db.updateMany('emails', plan.map((p) => [p.id, { status: 'scheduled', sendAt: p.sendAt, windowEnd: p.until, error: null }]));
  await scheduler.reload();
  res.json({ count: plan.length, first: times[0].at, last: times.at(-1).at });
}));
app.post('/api/unschedule', wrap(async (req, res) => {
  const ids = new Set(req.body.ids || []);
  const rows = (await db.list('emails')).filter((e) => ids.has(e.id) && e.status === 'scheduled');
  await db.updateMany('emails', rows.map((e) => [e.id, { status: 'draft', sendAt: null, windowEnd: null }]));
  await scheduler.reload();
  res.json({ count: rows.length });
}));

// ---------- static site ----------
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

const port = process.env.PORT || 3000;
await loadAccount();
await scheduler.start();
const host = PASSWORD ? '0.0.0.0' : '127.0.0.1'; // no password => only this computer can open it
app.listen(port, host, () => console.log(`\n  Outreach Mailer is running:  http://localhost:${port}   | mail: ${mailMode} | storage: ${db.usingFirestore ? 'Firestore' : 'local file'}\n`));
