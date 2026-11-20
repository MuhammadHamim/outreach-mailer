import { useEffect, useState } from 'react'
// In-app dialogs (browser confirm()/alert() are blocked in sandboxed/embedded pages).
type Req = { msg: string; ok: string; info?: boolean; res: (v: boolean) => void }
let push: ((r: Req) => void) | null = null
export const ask = (msg: string, ok = 'Delete') => new Promise<boolean>((res) => (push ? push({ msg, ok, res }) : res(window.confirm(msg))))
export const tell = (msg: string) => new Promise<boolean>((res) => (push ? push({ msg, ok: 'OK', info: true, res }) : res(true)))
export function DialogHost() {
  const [q, setQ] = useState<Req[]>([])
  useEffect(() => { push = (r) => setQ((a) => [...a, r]); return () => { push = null } }, [])
  const r = q[0]
  if (!r) return null
  const done = (v: boolean) => { r.res(v); setQ((a) => a.slice(1)) }
  return (
    <div className="anim-fade fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 print:hidden">
      <div className="anim-pop w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-sm text-slate-800">{r.msg}</p>
        <div className="mt-4 flex justify-end gap-2">
          {!r.info && <button className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => done(false)}>Cancel</button>}
          <button className={`rounded-lg px-3.5 py-2 text-sm font-semibold text-white ${r.info ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`} onClick={() => done(true)}>{r.ok}</button>
        </div>
      </div>
    </div>
  )
}
