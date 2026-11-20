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

export async function loadAccount() { const s = await db.get('settings', 'creds'); if (s) acct = { ...acct, ...s }; accounts = (await db.get('settings', 'mailAccounts')) || []; if (!accounts.length && acct.email) { acct.id ||= crypto.randomUUID(); accounts = [acct]; await db.set('settings','mailAccounts',accounts); } else { accounts = accounts.map(a => ({...a, id:a.id || crypto.randomUUID()})); } const active = accounts.find(x => x.id === acct.id) || accounts[0]; if (active) { acct = active; await db.set('settings','creds',acct); } transport = null; }

function server() {
  const p = byId(acct.provider);
  const own = true;
  return { host: own && acct.host ? acct.host : p.host, port: own && acct.port ? Number(acct.port) : p.port, security: own && acct.security ? acct.security : p.security };
}
export const getAccount = () => ({ id: acct.id, provider: byId(acct.provider).id, email: acct.email, name: acct.name, hasCode: !!acct.code, replyTo: acct.replyTo || '', username: acct.username || '', imapHost: acct.imapHost || '', imapPort: acct.imapPort || 0, ...server(), accounts: accounts.map(a => ({ id:a.id, provider:a.provider, email:a.email, name:a.name, hasCode:!!a.code })), editableServer:true });
export function imapCredentials() { const s = server(), i = imapFor(acct.provider, s.host); return { host: acct.imapHost || i.host, port: Number(acct.imapPort) || i.port, user: acct.username || acct.email, pass: acct.code, address: acct.email, provider: acct.provider, ready: !!(acct.email && acct.code) }; }

export async function saveAccount(b) {
  const p = byId(b.provider);
  const next = {
    provider: p.id, email: String(b.email || '').trim(), name: String(b.name || '').trim() || 'Muhammad Hamim',
    id: b.id || crypto.randomUUID(), code: b.secret ? String(b.secret).replace(/\s/g, '') : (b.id ? accounts.find(a=>a.id===b.id)?.code : ''),
    replyTo: String(b.replyTo || '').trim(), username: String(b.username || '').trim(),
    host: String(b.host || '').trim(), imapHost: String(b.imapHost || '').trim(), imapPort: Number(b.imapPort) || 0, port: Number(b.port) || p.port, security: String(b.security || p.security),
  };
  if (!/^\S+@\S+\.\S+$/.test(next.email)) throw new Error('Enter a valid email address');
  if (next.replyTo && !/^\S+@\S+\.\S+$/.test(next.replyTo)) throw new Error('Reply-to is not a valid email address');
  if (!(next.host || p.host)) throw new Error('Enter the SMTP server host');
  const idx = accounts.findIndex(a=>a.id===next.id || (a.email.toLowerCase()===next.email.toLowerCase() && !b.id)); if (idx >= 0) { next.id=accounts[idx].id; if (!b.secret) next.code=accounts[idx].code; accounts[idx] = next; } else accounts.push(next);
  await db.set('settings', 'mailAccounts', accounts); await db.set('settings', 'creds', next); acct = next; transport?.close?.(); transport = null;
}

export async function selectAccount(id) { const found=accounts.find(a=>a.id===id); if(!found) throw new Error('Account not found'); acct=found; await db.set('settings','creds',acct); transport?.close?.(); transport=null; }
export async function deleteAccount(id) { accounts=accounts.filter(a=>a.id!==id); if(!accounts.length) acct={...acct,id:null,email:'',code:''}; else if(acct.id===id) acct=accounts[0]; await db.set('settings','mailAccounts',accounts); await db.set('settings','creds',acct); transport?.close?.(); transport=null; }

const getTransport = () => {
  if (transport) return transport;
  if (mailMode === 'dry') return (transport = nodemailer.createTransport({ jsonTransport: true }));
  const s = server();
  return (transport = nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.security === 'ssl', requireTLS: s.security === 'starttls', ignoreTLS: s.security === 'none',
    auth: { user: acct.username || acct.email, pass: acct.code },
    pool: true, maxConnections: 1, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000,
  }));
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

export async function sendEmail({ to, subject, body, attachments = [], inReplyTo, references }) {
  if (mailMode === 'smtp' && (!acct.email || !acct.code)) throw new Error('Email account is not set up yet - open Settings, choose your provider and enter your email and password');
  const files = [];
  for (const id of attachments) { const { meta, buffer } = await loadDoc(id); files.push({ filename: meta.name, content: buffer }); }
  try {
    const info = await getTransport().sendMail({ from: { name: acct.name, address: acct.email || 'test@example.com' }, to, subject, text: body, attachments: files, ...(acct.replyTo ? { replyTo: acct.replyTo } : {}), ...(inReplyTo ? { inReplyTo, references: references || inReplyTo } : {}) });
    if (mailMode === 'dry') console.log(`[dry-run] would send to ${to} | ${subject} | ${files.length} attachment(s)`);
    return info.messageId;
  } catch (e) { throw new Error(explainError(e, acct.provider)); }
}

export async function smtpCheck() {
  if (mailMode === 'dry') return { ok: true, mode: 'dry', message: 'Dry-run mode: nothing is actually sent.' };
  if (!acct.email || !acct.code) return { ok: false, message: 'Choose your provider, enter your email and password above and save first.' };
  const s = server(), p = byId(acct.provider);
  const reach = await new Promise((resolve) => {
    const c = net.connect({ host: s.host, port: s.port, timeout: 8000 });
    c.on('connect', () => { c.destroy(); resolve(true); });
    c.on('timeout', () => { c.destroy(); resolve(false); });
    c.on('error', () => resolve(false));
  });
  if (!reach) return { ok: false, message: explainError({ code: 'ETIMEDOUT' }, p.id) + ` (${s.host}:${s.port})` };
  try { await getTransport().verify(); return { ok: true, message: `Connected to ${p.name} and logged in as ${acct.email}.` }; }
  catch (e) { return { ok: false, message: explainError(e, p.id) }; }
}
