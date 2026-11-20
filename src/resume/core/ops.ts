// Pure, immutable operations on the resume document. Every editor action is one of these,
// which keeps undo/redo trivial (history stores references) and the logic easy to test.
import type { Data, Fmt, Layout, Obj } from './data'
import { fontCss } from './fonts'

export const newId = () => Math.random().toString(36).slice(2, 10)
export const objId = () => 'o_' + newId()
export const isObjId = (id: string) => id.startsWith('o_')
const defd = <O extends object>(o: O): O => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as O

export type Geo = { id: string; x?: number; y?: number; w?: number; h?: number; detachW?: number }
export type StyleP = { color?: string; size?: number; bold?: boolean; italic?: boolean; underline?: boolean; align?: 'left' | 'center' | 'right'; font?: string; opacity?: number }

// ----- free objects -----
export function mapObjs(d: Data, fn: (o: Obj, pi: number) => Obj | null): Data {
  if (!d.layout) return d
  return { ...d, layout: { pages: d.layout.pages.map((p, pi) => ({ ...p, objects: p.objects.flatMap((o) => { const r = fn(o, pi); return r ? [r] : [] }) })) } }
}
export function findObj(d: Data, id: string) {
  const pgs = d.layout?.pages || []
  for (let pi = 0; pi < pgs.length; pi++) { const o = pgs[pi].objects.find((q) => q.id === id); if (o) return { pi, o } }
  return null
}
export const patchObjs = (d: Data, ps: Record<string, Partial<Obj>>): Data => mapObjs(d, (o) => (ps[o.id] ? { ...o, ...ps[o.id] } : o))
const ensure = (l: Layout | undefined, n: number): Layout => { const pages = l ? [...l.pages] : []; while (pages.length <= n) pages.push({ objects: [] }); return { pages } }
export function addObjs(d: Data, pi: number, objs: Obj[]): Data {
  const l = ensure(d.layout, pi); l.pages[pi] = { ...l.pages[pi], objects: [...l.pages[pi].objects, ...objs] }
  return { ...d, layout: l }
}
export function addPage(d: Data, n: number): Data { return { ...d, layout: ensure(d.layout, n) } }
export function delPage(d: Data, pi: number): Data { return d.layout ? { ...d, layout: { pages: d.layout.pages.filter((_, i) => i !== pi) } } : d }
export function setPageBg(d: Data, pi: number, bg: string): Data {
  const l = ensure(d.layout, pi); l.pages[pi] = { ...l.pages[pi], bg }
  return { ...d, layout: l }
}
export function duplicateObjs(d: Data, ids: string[]) {
  const grp = new Map<string, string>(), out: string[] = []
  const data = mapObjsAdd(d, ids, (o) => {
    const id = objId(); out.push(id)
    let g = o.grp; if (g) { if (!grp.has(g)) grp.set(g, newId()); g = grp.get(g) }
    return { ...o, id, grp: g, x: o.x + 16, y: o.y + 16 }
  })
  return { data, ids: out }
}
function mapObjsAdd(d: Data, ids: string[], make: (o: Obj) => Obj): Data {
  if (!d.layout) return d
  return { ...d, layout: { pages: d.layout.pages.map((p) => ({ ...p, objects: p.objects.flatMap((o) => (ids.includes(o.id) ? [o, make(o)] : [o])) })) } }
}
/** Stacking order of free objects: 'front' | 'back' | 'up' | 'down'. */
export function reorder(d: Data, ids: string[], k: 'front' | 'back' | 'up' | 'down'): Data {
  return mapPages(d, (objs) => {
    const sel = objs.filter((o) => ids.includes(o.id)), rest = objs.filter((o) => !ids.includes(o.id))
    if (!sel.length) return objs
    if (k === 'front') return [...rest, ...sel]
    if (k === 'back') return [...sel, ...rest]
    const a = [...objs]
    if (k === 'up') for (let i = a.length - 2; i >= 0; i--) { if (ids.includes(a[i].id) && !ids.includes(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]] }
    else for (let i = 1; i < a.length; i++) { if (ids.includes(a[i].id) && !ids.includes(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]] }
    return a
  })
}
function mapPages(d: Data, fn: (o: Obj[]) => Obj[]): Data { return d.layout ? { ...d, layout: { pages: d.layout.pages.map((p) => ({ ...p, objects: fn(p.objects) })) } } : d }

// ----- per-element formatting of template content (fmt) -----
export const patchFmts = (d: Data, ps: Record<string, Fmt>): Data => { const m = { ...d.fmt }; for (const id in ps) m[id] = { ...m[id], ...ps[id] }; return { ...d, fmt: m } }
export const patchFmt = (d: Data, id: string, p: Fmt) => patchFmts(d, { [id]: p })
export function clearFmt(d: Data, id: string): Data { const m = { ...d.fmt }; delete m[id]; return { ...d, fmt: Object.keys(m).length ? m : undefined } }

// ----- operations that work on any selection (template elements and free objects alike) -----
/** Move/resize. A template element becomes absolutely positioned on first move, so it no longer affects its neighbours. */
export function applyGeo(d: Data, items: Geo[]): Data {
  const op: Record<string, Partial<Obj>> = {}, fp: Record<string, Fmt> = {}
  for (const g of items) {
    if (isObjId(g.id)) op[g.id] = defd({ x: g.x, y: g.y, w: g.w, h: g.h })
    else {
      const was = d.fmt?.[g.id]
      const w = g.w ?? (was?.ax === undefined ? g.detachW : undefined)
      fp[g.id] = { ax: g.x, ay: g.y, dx: undefined, dy: undefined, ...(w !== undefined ? { w } : {}) }
    }
  }
  return patchFmts(patchObjs(d, op), fp)
}
export function applyStyle(d: Data, ids: string[], s: StyleP): Data {
  const op: Record<string, Partial<Obj>> = {}, fp: Record<string, Fmt> = {}
  for (const id of ids) {
    if (!isObjId(id)) { fp[id] = defd({ ...s }); continue }
    const o = findObj(d, id)?.o; if (!o) continue
    if (o.type === 'text') op[id] = defd({ color: s.color, size: s.size, bold: s.bold, italic: s.italic, underline: s.underline, align: s.align, font: s.font !== undefined ? fontCss(s.font) : undefined, opacity: s.opacity })
    else if (o.type === 'line') op[id] = defd({ color: s.color, opacity: s.opacity })
    else if (o.type === 'rect') op[id] = defd({ fill: s.color, opacity: s.opacity })
    else if (o.type === 'icon') op[id] = defd({ stroke: s.color, opacity: s.opacity })
    else op[id] = defd({ opacity: s.opacity })
  }
  return patchFmts(patchObjs(d, op), fp)
}
const flag = (d: Data, ids: string[], p: { hidden?: boolean; locked?: boolean; grp?: string | undefined }): Data => {
  const op: Record<string, Partial<Obj>> = {}, fp: Record<string, Fmt> = {}
  for (const id of ids) { if (isObjId(id)) op[id] = p; else fp[id] = p }
  return patchFmts(patchObjs(d, op), fp)
}
export const hideMany = (d: Data, ids: string[], hidden: boolean) => flag(d, ids, { hidden: hidden || undefined })
export const lockMany = (d: Data, ids: string[], locked: boolean) => flag(d, ids, { locked: locked || undefined })
export const setGroup = (d: Data, ids: string[], grp?: string) => flag(d, ids, { grp })
export const groupOf = (d: Data, id: string) => (isObjId(id) ? findObj(d, id)?.o.grp : d.fmt?.[id]?.grp)
export function members(d: Data, grp: string): string[] {
  const out = Object.entries(d.fmt || {}).filter(([, f]) => f.grp === grp).map(([id]) => id)
  d.layout?.pages.forEach((p) => p.objects.forEach((o) => { if (o.grp === grp) out.push(o.id) }))
  return out
}
/** Delete: free objects are removed, template elements are hidden (their content stays in the form). */
export function removeIds(d: Data, ids: string[]): Data {
  const objs = new Set(ids.filter(isObjId))
  return hideMany(mapObjs(d, (o) => (objs.has(o.id) ? null : o)), ids.filter((i) => !isObjId(i)), true)
}
