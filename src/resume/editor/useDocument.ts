// The single source of truth for one resume: state, autosave and one undo/redo history for every kind of edit.
import { useEffect, useRef, useState } from 'react'
import { setByEid, type Data, type Rec } from '../core/data'

export function useDocument(init: Rec, persist: (r: Rec) => Promise<void>) {
  const [rec, setRec] = useState(init), [saved, setSaved] = useState(true)
  const ref = useRef(rec); ref.current = rec
  const hist = useRef<{ past: Rec[]; future: Rec[]; t: number }>({ past: [], future: [], t: 0 })

  /** Commit a new version. Discrete actions are always their own undo step; `merge` edits (typing, dragging) share a step when less than 700ms apart. */
  const apply = (n: Rec, merge = false) => {
    const h = hist.current, now = Date.now()
    if (!merge || now - h.t > 700) { h.past.push(ref.current); if (h.past.length > 100) h.past.shift() }
    h.future = []; h.t = now; ref.current = n; setRec(n); setSaved(false)
  }
  const edit = (f: (d: Data) => Data, merge = false) => { const d = ref.current.data, n = f(d); if (n !== d) apply({ ...ref.current, data: n }, merge) }
  const up = (f: (d: Data) => void) => edit((d) => { const x = structuredClone(d); f(x); return x }, true) // mutate a copy (form code)
  const patch = (f: (r: Rec) => Rec) => apply(f(ref.current), true)
  const commit = (id: string, v: string) => edit((d) => { const x = structuredClone(d); return setByEid(x, id, v) ? x : d }, true)
  const breakHistory = () => { hist.current.t = 0 } // the next merge edit starts a new undo step
  const jump = (from: 'past' | 'future', to: 'past' | 'future') => { const h = hist.current, q = h[from].pop(); if (!q) return false; h[to].push(ref.current); ref.current = q; setRec(q); setSaved(false); h.t = 0; return true }
  const undo = () => jump('past', 'future'), redo = () => jump('future', 'past')

  useEffect(() => {
    if (saved) return
    const t = setTimeout(() => persist({ ...rec, updated: Date.now() }).then(() => setSaved(true)), 1200)
    return () => clearTimeout(t)
  }, [rec, saved])
  const flush = () => persist({ ...ref.current, updated: Date.now() }).then(() => setSaved(true))
  return { rec, d: rec.data, cur: () => ref.current.data, edit, breakHistory, up, patch, commit, undo, redo, canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0, saved, flush }
}
export type Doc = ReturnType<typeof useDocument>
