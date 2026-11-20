// Reads replies from the mailbox over IMAP (same account as sending) and connects them to the sent emails.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createHash } from 'node:crypto';
import * as db from './db.js';
import { imapCredentials, mailMode } from './mailer.js';
import { explainImapError } from './providers.js';

let running = false;
export const status = { lastSync: 0, error: '', syncing: false };

const norm = (id) => String(id || '').replace(/[<>\s]/g, '').toLowerCase();
const AUTO = /auto(matic)?[ -]?reply|out of office|automatic reply|vacation|自动回复|自动答复|外出/i;
const QUOTE_START = [/^\s*On .{5,200}wrote:\s*$/i, /^\s*-{2,}\s*(Original Message|Forwarded message)/i, /^\s*_{5,}\s*$/, /^\s*(From|发件人|寄件者):\s.+$/i, /^\s*在 .{3,80}写道[:：]\s*$/, /^\s*>/];

/** Split a reply into what the person wrote and the quoted history below it. */
export function splitQuoted(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const i = lines.findIndex((l, n) => n > 0 && QUOTE_START.some((re) => re.test(l)));
  if (i < 0) return { text: lines.join('\n').trim(), quoted: '' };
  return { text: lines.slice(0, i).join('\n').trim(), quoted: lines.slice(i).join('\n').trim().slice(0, 12000) };
}

export async function syncReplies() {
  if (running) return { skipped: true };
  const cred = imapCredentials();
  if (mailMode === 'dry' || !cred.ready) return { checked: 0, newReplies: 0, skipped: true };
  const sent = (await db.list('emails')).filter((e) => ['sent', 'replied'].includes(e.status) && e.sentAt && e.to);
  if (!sent.length) { status.lastSync = Date.now(); return { checked: 0, newReplies: 0 }; }
  running = true; status.syncing = true; status.error = '';
  const me = cred.address.toLowerCase();
  const byMsg = new Map(sent.filter((e) => e.messageId).map((e) => [norm(e.messageId), e]));
  const byAddr = new Map();
  for (const e of sent.sort((a, b) => a.sentAt - b.sentAt)) { const k = e.to.toLowerCase(); (byAddr.get(k) || byAddr.set(k, []).get(k)).push(e); }
  const state = (await db.get('settings', 'inbox')) || {};
  const client = new ImapFlow({ host: cred.host, port: cred.port, secure: true, auth: { user: cred.user, pass: cred.pass }, logger: false, clientInfo: { name: 'OutreachMailer', version: '1.0' }, socketTimeout: 90000, tls: { rejectUnauthorized: process.env.IMAP_TLS_INSECURE !== '1' } });
  client.on('error', () => {});
  let newReplies = 0, checked = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const validity = String(client.mailbox.uidValidity);
      const since = new Date(Math.min(...sent.map((e) => e.sentAt)) - 86400000);
      let uids = (await client.search({ since }, { uid: true })) || [];
      if (state.validity === validity && state.lastUid) uids = uids.filter((u) => u > state.lastUid);
      checked = uids.length;
      const candidates = [];
      if (uids.length) {
        for await (const m of client.fetch(uids.join(','), { uid: true, envelope: true, internalDate: true, headers: ['references', 'in-reply-to'] }, { uid: true })) {
          const from = (m.envelope.from?.[0]?.address || '').toLowerCase();
          if (!from || from === me) continue;
          const hdr = m.headers ? m.headers.toString() : '';
          const refs = [m.envelope.inReplyTo, ...(hdr.match(/<[^>]+>/g) || [])].map(norm).filter(Boolean);
          let parent = refs.map((r) => byMsg.get(r)).find(Boolean);
          const date = m.envelope.date ? +new Date(m.envelope.date) : +m.internalDate;
          if (!parent) { const list = (byAddr.get(from) || []).filter((e) => e.sentAt <= date + 60000); parent = list[list.length - 1]; }
          if (parent) candidates.push({ uid: m.uid, parent });
        }
      }
      for (const c of candidates) {
        const msg = await client.fetchOne(String(c.uid), { source: true }, { uid: true });
        if (!msg?.source) continue;
        const mail = await simpleParser(msg.source);
        const id = createHash('sha1').update(String(mail.messageId || `${validity}-${c.uid}`)).digest('hex').slice(0, 24);
        if (await db.get('replies', id)) continue;
        const { text, quoted } = splitQuoted(mail.text || (mail.html || '').replace(/<[^>]+>/g, ' '));
        const auto = AUTO.test(`${mail.subject || ''} ${mail.headers?.get('auto-submitted') || ''}`) || /auto-(replied|generated)/i.test(String(mail.headers?.get('auto-submitted') || ''));
        await db.set('replies', id, {
          emailId: c.parent.id, direction: 'in', messageId: mail.messageId || '', from: mail.from?.value?.[0]?.address || '', fromName: mail.from?.value?.[0]?.name || '',
          subject: mail.subject || '', date: +new Date(mail.date || Date.now()), text: text.slice(0, 20000), quoted, auto,
          attachments: (mail.attachments || []).map((a) => ({ filename: a.filename || 'file', size: a.size || 0 })), read: false, createdAt: Date.now(),
        });
        const cur = await db.get('emails', c.parent.id);
        if (cur) await db.update('emails', cur.id, { replyCount: (cur.replyCount || 0) + 1, unread: (cur.unread || 0) + 1, lastReplyAt: Date.now(), ...(cur.status === 'sent' && !auto ? { status: 'replied' } : {}) });
        newReplies++;
      }
      await db.set('settings', 'inbox', { validity, lastUid: uids.length ? Math.max(...uids) : state.lastUid || 0 });
    } finally { lock.release(); }
    await client.logout();
    status.lastSync = Date.now();
  } catch (e) {
    status.error = explainImapError(e, cred.provider);
    try { await client.close(); } catch { /* ignore */ }
    throw new Error(status.error);
  } finally { running = false; status.syncing = false; }
  return { checked, newReplies };
}
