// Tiny data layer: Firestore in production, in-memory Map when no credentials (local testing only).
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
const creds = b64 ? JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) : raw ? JSON.parse(raw) : null;

export const usingFirestore = !!creds;
export const newId = () => randomUUID();
const chunk = (arr, n = 400) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

let impl;
if (creds) {
  let admin;
  try { admin = (await import('firebase-admin')).default; }
  catch { throw new Error('Firestore credentials were found but firebase-admin is not installed. Run: npm install firebase-admin'); }
  admin.initializeApp({ credential: admin.credential.cert(creds) });
  const fs = admin.firestore();
  fs.settings({ ignoreUndefinedProperties: true });
  const col = (c) => fs.collection(c);
  const pack = (d) => ({ id: d.id, ...d.data() });
  impl = {
    list: async (c) => (await col(c).get()).docs.map(pack),
    listWhere: async (c, f, v) => (await col(c).where(f, '==', v).get()).docs.map(pack),
    get: async (c, id) => { const d = await col(c).doc(id).get(); return d.exists ? pack(d) : null; },
    set: (c, id, data) => col(c).doc(id).set(data),
    update: (c, id, data) => col(c).doc(id).update(data),
    remove: (c, id) => col(c).doc(id).delete(),
    // atomically move a doc from one status to another; returns false if someone else already did
    claim: (c, id, from, patch) => fs.runTransaction(async (t) => {
      const ref = col(c).doc(id); const d = await t.get(ref);
      if (!d.exists || d.data().status !== from) return false;
      t.update(ref, patch); return true;
    }),
    setMany: async (c, pairs) => { for (const part of chunk(pairs)) { const b = fs.batch(); part.forEach(([id, d]) => b.set(col(c).doc(id), d)); await b.commit(); } },
    updateMany: async (c, pairs) => { for (const part of chunk(pairs)) { const b = fs.batch(); part.forEach(([id, d]) => b.update(col(c).doc(id), d)); await b.commit(); } },
    removeMany: async (c, ids) => { for (const part of chunk(ids)) { const b = fs.batch(); part.forEach((id) => b.delete(col(c).doc(id))); await b.commit(); } },
  };
} else {
  // Local mode: everything lives in ./data/db.json on this computer.
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'db.json');
  let store = {};
  try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first run */ }
  let timer = null;
  const flush = () => { clearTimeout(timer); timer = null; const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(store)); fs.renameSync(tmp, file); };
  const save = () => { timer ||= setTimeout(flush, 150); };
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (timer) flush(); process.exit(0); });
  process.on('exit', () => { if (timer) flush(); });
  console.log(`[db] Local storage: ${file}`);
  const t = (c) => (store[c] ||= {});
  const copy = (o) => structuredClone(o);
  impl = {
    list: async (c) => Object.entries(t(c)).map(([id, d]) => ({ id, ...copy(d) })),
    listWhere: async (c, f, v) => Object.entries(t(c)).filter(([, d]) => d[f] === v).map(([id, d]) => ({ id, ...copy(d) })),
    get: async (c, id) => (t(c)[id] ? { id, ...copy(t(c)[id]) } : null),
    set: async (c, id, d) => { t(c)[id] = copy(d); save(); },
    update: async (c, id, d) => { if (!t(c)[id]) throw new Error('not found'); t(c)[id] = { ...t(c)[id], ...copy(d) }; save(); },
    remove: async (c, id) => { delete t(c)[id]; save(); },
    claim: async (c, id, from, patch) => { const d = t(c)[id]; if (!d || d.status !== from) return false; t(c)[id] = { ...d, ...patch }; save(); return true; },
    setMany: async (c, pairs) => { pairs.forEach(([id, d]) => { t(c)[id] = copy(d); }); save(); },
    updateMany: async (c, pairs) => { pairs.forEach(([id, d]) => { t(c)[id] = { ...t(c)[id], ...copy(d) }; }); save(); },
    removeMany: async (c, ids) => { ids.forEach((id) => delete t(c)[id]); save(); },
  };
}
export const { list, listWhere, get, set, update, remove, claim, setMany, updateMany, removeMany } = impl;
