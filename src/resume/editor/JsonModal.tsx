import { useState } from 'react'
import { JSON_REF, SAMPLE, normalize, type Data } from '../core/data'
import { B, inp, mini, pri, sec } from '../ui/kit'

export function RefList() {
  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-xs">
      {JSON_REF.map(([k, v]) => <div key={k} className="grid gap-1 p-2 sm:grid-cols-[11rem_1fr]"><code className="break-all font-semibold text-indigo-700">{k}</code><span className="text-slate-600">{v}</span></div>)}
    </div>
  )
}
// Long embedded images would flood the view; the copy buttons always use the full JSON.
const pretty = (v: unknown, short: boolean) => JSON.stringify(v, (k, x) => (short && k === 'src' && typeof x === 'string' && x.length > 120 ? `${x.slice(0, 40)}… (${Math.round(x.length / 1024)} KB image)` : x), 2)

/** Copy the resume as JSON (always up to date with the canvas and form) or paste JSON to rebuild it. */
export function JsonModal({ data, tpl, onApply, onClose }: { data: Data; tpl?: string; onApply: (d: Data) => void; onClose: () => void }) {
  const [txt, setTxt] = useState(''), [err, setErr] = useState(''), [note, setNote] = useState(''), [tab, setTab] = useState<'live' | 'sample'>(tpl ? 'live' : 'sample')
  const live = { template: tpl, ...data }, shown = tab === 'live' ? pretty(live, true) : pretty(SAMPLE, true)
  const copy = (s: string) => navigator.clipboard.writeText(s).then(() => { setNote('Copied!'); setTimeout(() => setNote(''), 1500) })
  const fill = () => { try { onApply(normalize(JSON.parse(txt))); onClose() } catch (e) { setErr((e as Error).message) } }
  return (
    <div className="anim-fade fixed inset-0 z-50 bg-black/40 md:grid md:place-items-center md:p-4 print:hidden">
      <div className="anim-pop flex h-full w-full min-w-0 flex-col overflow-hidden bg-white shadow-xl md:h-auto md:max-h-[92dvh] md:max-w-5xl md:rounded-xl">
        <div className="flex items-center gap-2 border-b px-4 py-3"><h2 className="text-lg font-semibold">Import / export JSON</h2><span className="text-sm text-green-600">{note}</span><button className={mini + ' ml-auto'} onClick={onClose}>Close</button></div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
          <p className="mb-3 text-xs text-slate-500">“My resume” is always the current version, including everything you changed on the canvas. Copy it, paste it later (or on another device) and click Auto fill to get exactly the same resume back.</p>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-1"><B on={tab === 'live'} onClick={() => setTab('live')}>My resume</B><B on={tab === 'sample'} onClick={() => setTab('sample')}>Sample format</B></div>
              <button className={sec} onClick={() => copy(tab === 'live' ? JSON.stringify(live, null, 2) : JSON.stringify(SAMPLE, null, 2))}>Copy {tab === 'live' ? 'my resume JSON' : 'sample format'}</button>
              <pre className="h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-slate-50 p-2 text-xs md:h-96">{shown}</pre>
              <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-sm font-semibold">Field reference: every option</summary><div className="mt-2"><RefList /></div></details>
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex min-h-9 items-center text-sm font-medium text-slate-700">Paste resume JSON</div>
              <textarea className={inp + ' h-56 font-mono md:h-96'} placeholder="Paste JSON here" value={txt} onChange={(e) => { setTxt(e.target.value); setErr('') }} />
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>
          </div>
        </div>
        <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button className={pri + ' w-full'} disabled={!txt.trim()} onClick={fill}>Auto fill (replaces current content)</button></div>
      </div>
    </div>
  )
}
