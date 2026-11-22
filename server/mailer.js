import nodemailer from 'nodemailer';
import net from 'node:net';
import crypto from 'node:crypto';
import * as db from './db.js';
import { byId, explainError, imapFor } from './providers.js';

export const mailMode = process.env.MAIL_MODE === 'dry' ? 'dry' : 'smtp';

// Email account: saved in the local database (Settings page) or taken from environment variables.
// QQ_EMAIL / QQ_AUTH_CODE still work; MAIL_PROVIDER / MAIL_EMAIL / MAIL_PASSWORD / SMTP_HOST / SMTP_PORT / SMTP_SECURITY are the general form.
let acct = {
  provider: process.env.MAIL_PROVIDER || 'qq',
  email: process.env.MAIL_EMAIL || process.env.QQ_EMAIL || '',
  code: process.env.MAIL_PASSWORD || process.env.QQ_AUTH_CODE || '',
  name: process.env.FROM_NAME || 'Muhammad Hamim',
  host: process.env.SMTP_HOST || '', port: Number(process.env.SMTP_PORT) || 0, security: process.env.SMTP_SECURITY || '',
  username: '', replyTo: '', imapHost: '', imapPort: 0,
};
let transport;
let accounts = [];

const transports = new Map();           // accountId -> { t, sig }
const health = new Map();               // accountId -> { ok, at, message }
let rotate = false;
let stats = { day: '', counts: {} };    // per-account sends today (UTC day)
const dayKey = () => new Date().toISOString().slice(0, 10);
const sentToday = (id) => (stats.day === dayKey() ? stats.counts[id] || 0 : 0);
const find = (id) => accounts.find((a) => a.id === id) || acct;
const AUTH_OR_NET = new Set(['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS']);
const usable = (a) => {
  const h = health.get(a.id);
  return (mailMode === 'dry' || !!(a.email && a.code)) && a.enabled !== false
    && !(a.dailyLimit && sentToday(a.id) >= a.dailyLimit)
    && !(h && h.ok === false && Date.now() - h.at < 10 * 60 * 1000); // failed recently: cool off 10 min
};
async function bump(id) {
  if (stats.day !== dayKey()) stats = { day: dayKey(), counts: {} };
  stats.counts[id] = (stats.counts[id] || 0) + 1;
  await db.set('settings', 'acctStats', stats);
}
export const allAccounts = () => accounts;
export async function setRotate(on) { rotate = !!on; await db.set('settings', 'mailRotate', rotate); }
export async function patchAccount(id, b) {
  const a = accounts.find((x) => x.id === id); if (!a) throw new Error('Account not found');
  if ('enabled' in b) a.enabled = !!b.enabled;
  if ('dailyLimit' in b) a.dailyLimit = Math.max(0, Number(b.dailyLimit) || 0);
  if (acct.id === id) acct = a;
  await db.set('settings', 'mailAccounts', accounts); await db.set('settings', 'creds', acct);
}
// Which account sends the next scheduled email. null = none available right now.
export function pickAccountId(preferred) {
  const pref = accounts.find((a) => a.id === preferred);
  const pool = pref ? [pref] : rotate ? accounts : [acct];
  const ok = pool.filter(usable).sort((x, y) => sentToday(x.id) - sentToday(y.id));
  return ok[0] ? ok[0].id : mailMode === 'dry' ? acct.id : null;
}

export async function loadAccount() {
  const s = await db.get('settings', 'creds'); if (s) acct = { ...acct, ...s };
  accounts = (await db.get('settings', 'mailAccounts')) || [];
  if (!accounts.length && acct.email) { acct.id ||= crypto.randomUUID(); accounts = [acct]; await db.set('settings','mailAccounts',accounts); } else { accounts = accounts.map(a => ({...a, id:a.id || crypto.randomUUID()})); }
  const active = accounts.find(x => x.id === acct.id) || accounts[0];
  if (active) { acct = active; await db.set('settings','creds',acct); }
  transport = null; rotate = !!(await db.get('settings', 'mailRotate')); stats = (await db.get('settings', 'acctStats')) || stats;
}

function server(a = acct) {
  const p = byId(a.provider);
  return { host: a.host || p.host, port: Number(a.port) || p.port, security: a.security || p.security };
}
export const getAccount = () => ({ id: acct.id, provider: byId(acct.provider).id, email: acct.email, name: acct.name, hasCode: !!acct.code, replyTo: acct.replyTo || '', username: acct.username || '', imapHost: acct.imapHost || '', imapPort: acct.imapPort || 0, dailyLimit: acct.dailyLimit || 0, ...server(), rotate, accounts: accounts.map(a => ({ id:a.id, provider:a.provider, email:a.email, name:a.name, hasCode:!!a.code, enabled: a.enabled !== false, dailyLimit: a.dailyLimit || 0, sentToday: sentToday(a.id), health: health.get(a.id) || null })), editableServer:true });
export function imapCredentials(a = acct) { const s = server(a), i = imapFor(a.provider, s.host); return { host: a.imapHost || i.host, port: Number(a.imapPort) || i.port, user: a.username || a.email, pass: a.code, address: a.email, provider: a.provider, id: a.id, ready: !!(a.email && a.code) }; }

export async function saveAccount(b) {
  const p = byId(b.provider);
  const next = {
    provider: p.id, email: String(b.email || '').trim(), name: String(b.name || '').trim() || 'Muhammad Hamim',
    id: b.id || crypto.randomUUID(), code: b.secret ? String(b.secret).replace(/\s/g, '') : (b.id ? accounts.find(a=>a.id===b.id)?.code : ''),
    replyTo: String(b.replyTo || '').trim(), username: String(b.username || '').trim(),
    host: String(b.host || '').trim(), imapHost: String(b.imapHost || '').trim(), imapPort: Number(b.imapPort) || 0, port: Number(b.port) || p.port, security: String(b.security || p.security),
    dailyLimit: Math.max(0, Number(b.dailyLimit) || 0), enabled: accounts.find(a => a.id === b.id)?.enabled !== false,
  };
  if (!/^\S+@\S+\.\S+$/.test(next.email)) throw new Error('Enter a valid email address');
  if (next.replyTo && !/^\S+@\S+\.\S+$/.test(next.replyTo)) throw new Error('Reply-to is not a valid email address');
  if (!(next.host || p.host)) throw new Error('Enter the SMTP server host');
  const idx = accounts.findIndex(a=>a.id===next.id || (a.email.toLowerCase()===next.email.toLowerCase() && !b.id)); if (idx >= 0) { next.id=accounts[idx].id; if (!b.secret) next.code=accounts[idx].code; accounts[idx] = next; } else accounts.push(next);
  await db.set('settings', 'mailAccounts', accounts); await db.set('settings', 'creds', next); acct = next; transport?.close?.(); transport = null;
}

export async function selectAccount(id) { const found=accounts.find(a=>a.id===id); if(!found) throw new Error('Account not found'); acct=found; await db.set('settings','creds',acct); transport?.close?.(); transport=null; }
export async function deleteAccount(id) { accounts=accounts.filter(a=>a.id!==id); if(!accounts.length) acct={...acct,id:null,email:'',code:''}; else if(acct.id===id) acct=accounts[0]; await db.set('settings','mailAccounts',accounts); await db.set('settings','creds',acct); transports.get(id)?.t.close?.(); transports.delete(id); health.delete(id); transport?.close?.(); transport=null; }

const getTransport = (a = acct) => {
  if (mailMode === 'dry') return (transport ||= nodemailer.createTransport({ jsonTransport: true }));
  const key = a.id || 'default', s = server(a), user = a.username || a.email;
  const sig = [s.host, s.port, s.security, user, a.code].join('|'); // changes whenever creds/server change
  const hit = transports.get(key);
  if (hit?.sig === sig) return hit.t;
  hit?.t.close?.();
  const t = nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.security === 'ssl', requireTLS: s.security === 'starttls', ignoreTLS: s.security === 'none',
    auth: { user, pass: a.code },
    pool: true, maxConnections: 1, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000,
  });
  transports.set(key, { t, sig });
  return t;
};

// documents are stored as base64 chunks (Firestore docs are limited to 1 MB each)
const cache = new Map();
export async function loadDoc(id) {
  if (cache.has(id)) return cache.get(id);
  const meta = await db.get('documents', id);
  if (!meta) throw new Error(`Attachment ${id} no longer exists`);
  let b64 = '';
  for (let i = 0; i < meta.chunks; i++) b64 += (await db.get('docchunks', `${id}_${i}`)).data;
  const val = { meta, buffer: Buffer.from(b64, 'base64') };
  cache.set(id, val);
  return val;
}
export const dropFromCache = (id) => cache.delete(id);

export async function sendEmail({ to, subject, body, html, attachments = [], inReplyTo, references, accountId }) {
  const a = find(accountId);
  if (mailMode === 'smtp' && (!a.email || !a.code)) throw new Error('Email account is not set up yet - open Settings, choose your provider and enter your email and password');
  const files = [];
  for (const id of attachments) { const { meta, buffer } = await loadDoc(id); files.push({ filename: meta.name, content: buffer }); }
  try {
    const info = await getTransport(a).sendMail({ from: { name: a.name, address: a.email || 'test@example.com' }, to, subject, text: body, ...(html ? { html } : {}), attachments: files, ...(a.replyTo ? { replyTo: a.replyTo } : {}), ...(inReplyTo ? { inReplyTo, references: references || inReplyTo } : {}) });
    if (mailMode === 'dry') console.log(`[dry-run] would send to ${to} | ${subject} | ${files.length} attachment(s)`);
    health.set(a.id, { ok: true, at: Date.now(), message: 'Last send OK' });
    bump(a.id).catch(() => {});
    return info.messageId;
  } catch (e) {
    const message = explainError(e, a.provider);
    if (AUTH_OR_NET.has(e.code)) health.set(a.id, { ok: false, at: Date.now(), message }); // a bad recipient shouldn't mark the account as broken
    throw new Error(message);
  }
}

export async function smtpCheck(accountId) {
  const a = find(accountId);
  if (mailMode === 'dry') return { ok: true, mode: 'dry', message: 'Dry-run mode: nothing is actually sent.' };
  if (!a.email || !a.code) return { ok: false, message: 'Choose your provider, enter your email and password above and save first.' };
  const s = server(a), p = byId(a.provider);
  const done = (r) => { health.set(a.id, { ok: r.ok, at: Date.now(), message: r.message }); return r; };
  const reach = await new Promise((resolve) => {
    const c = net.connect({ host: s.host, port: s.port, timeout: 8000 });
    c.on('connect', () => { c.destroy(); resolve(true); });
    c.on('timeout', () => { c.destroy(); resolve(false); });
    c.on('error', () => resolve(false));
  });
  if (!reach) return done({ ok: false, message: explainError({ code: 'ETIMEDOUT' }, p.id) + ` (${s.host}:${s.port})` });
  try { await getTransport(a).verify(); return done({ ok: true, message: `Connected to ${p.name} and logged in as ${a.email}.` }); }
  catch (e) { return done({ ok: false, message: explainError(e, p.id) }); }
}
