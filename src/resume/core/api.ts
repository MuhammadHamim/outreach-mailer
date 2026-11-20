// Storage for the resume editor: every resume is a JSON file in the "Resume" folder, written by the local server.
import { normalize, type Rec } from './data'

export type User = { uid: string; email: string; name: string }
export const LOCAL_USER: User = { uid: 'local', email: '', name: 'You' }

const j = async (r: Response) => {
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || r.statusText)
  return body
}
// Upgrade resumes saved in older formats so they always match the current data model.
const fix = (x: Rec): Rec => { try { return { ...x, data: normalize(x.data) } } catch { return { ...x, data: normalize({ basics: {}, sections: [] }) } } }

export async function list(_uid: string = LOCAL_USER.uid): Promise<{ dir: string; items: Rec[] }> {
  const r = await j(await fetch('/api/resumes'))
  return { dir: r.dir, items: (r.items as Rec[]).map(fix) }
}
export async function get(id: string): Promise<Rec | null> {
  const r = await fetch('/api/resumes/' + encodeURIComponent(id))
  if (r.status === 404) return null
  return fix(await j(r))
}
export async function save(_uid: string, r: Rec) {
  await j(await fetch('/api/resumes/' + encodeURIComponent(r.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }))
}
export async function remove(_uid: string, id: string) {
  await j(await fetch('/api/resumes/' + encodeURIComponent(id), { method: 'DELETE' }))
}
