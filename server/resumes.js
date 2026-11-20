// Resumes live as plain JSON files in <data folder>/Resume  (one file per resume, written on every autosave).
import fs from 'node:fs';
import path from 'node:path';

export const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const resumeDir = () => path.join(dataDir(), 'Resume');
const ID = /^[a-z0-9]{4,40}$/i;
const FILE_ID = /\[([a-z0-9]{4,40})\]\.json$/i;

const ensure = () => fs.mkdirSync(resumeDir(), { recursive: true });
const safeName = (s) => (String(s || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 60)) || 'Untitled resume';
const fileFor = (rec) => `${safeName(rec.name)} [${rec.id}].json`;

function readAll() {
  ensure();
  const out = [];
  for (const f of fs.readdirSync(resumeDir())) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(resumeDir(), f), 'utf8'));
      if (r && typeof r.id === 'string' && r.data && typeof r.data === 'object') out.push({ file: f, rec: r });
    } catch { /* not a resume file, ignore */ }
  }
  return out;
}

export const list = () => readAll().map((x) => x.rec).sort((a, b) => (b.updated || 0) - (a.updated || 0));
export const get = (id) => { if (!ID.test(id)) return null; return readAll().find((x) => x.rec.id === id)?.rec || null; };

export function save(id, rec) {
  if (!ID.test(id) || !rec || rec.id !== id || typeof rec.data !== 'object' || !rec.data) throw new Error('Invalid resume');
  ensure();
  const clean = { id, name: String(rec.name ?? 'Untitled resume'), template: String(rec.template || 'classic'), data: rec.data, updated: Number(rec.updated) || Date.now() };
  const target = path.join(resumeDir(), fileFor(clean)), tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(clean, null, 2));
  fs.renameSync(tmp, target);
  // the resume was renamed: remove the file(s) that carry its old name
  for (const f of fs.readdirSync(resumeDir())) if (f !== path.basename(target) && FILE_ID.exec(f)?.[1] === id) fs.rmSync(path.join(resumeDir(), f), { force: true });
  return clean;
}

export function remove(id) {
  if (!ID.test(id)) throw new Error('Invalid id');
  for (const x of readAll()) if (x.rec.id === id) fs.rmSync(path.join(resumeDir(), x.file), { force: true });
}
