// Translates between the uniform "properties" the inspector shows and how each kind of element stores them
// (free objects store fields on the object; template elements store overrides in `fmt`).
import { getByEid, setByEid, type Data, type Fmt, type Obj } from '../core/data'
import { FONTS } from '../core/fonts'
import { applyGeo, findObj, isObjId, patchFmt, patchObjs } from '../core/ops'
import { hex, nodeInfo } from './dom'

export type PType = 'text' | 'line' | 'rect' | 'image' | 'icon' | 'rule' | 'tags'
export type Props = {
  id: string; kind: 'obj' | 'flow'; type: PType
  x: number; y: number; w: number; h?: number; rot: number; opacity: number; radius?: number
  text?: string; font: string; size: number; bold: boolean; italic: boolean; underline: boolean; align: 'left' | 'center' | 'right'; lh: number; ls: number
  color: string; fill?: string; stroke?: string; sw?: number; thickness?: number; dash?: boolean; fit?: 'cover' | 'contain'; detachW?: number
}
const keyOf = (css?: string) => Object.entries(FONTS).find(([k, [, c]]) => k && c === css)?.[0] ?? ''

export function readProps(d: Data, id: string, scale: number): Props | null {
  if (isObjId(id)) {
    const o = findObj(d, id)?.o
    if (!o) return null
    return { id, kind: 'obj', type: o.type, x: o.x, y: o.y, w: o.w, h: o.type === 'line' || o.type === 'text' ? undefined : o.h ?? 50, rot: o.rot ?? 0, opacity: o.opacity ?? 1, radius: o.radius, text: o.text, font: keyOf(o.font), size: o.size ?? 14, bold: !!o.bold, italic: !!o.italic, underline: !!o.underline, align: o.align ?? 'left', lh: o.lh ?? 1.3, ls: o.ls ?? 0, color: (o.type === 'icon' ? o.stroke : o.color) || '#111827', fill: o.fill, stroke: o.stroke, sw: o.sw, thickness: o.thickness, dash: o.dash, fit: o.fit }
  }
  const f = d.fmt?.[id] || {}, info = nodeInfo(id, scale), type: PType = id.endsWith('.rule') ? 'rule' : id.endsWith('.tags') ? 'tags' : 'text'
  const el = info?.el, tg = el?.dataset.line ? el.querySelector<HTMLElement>('[data-lb]') : el, cs = tg ? getComputedStyle(tg) : null
  return {
    id, kind: 'flow', type, x: Math.round(f.ax ?? info?.r.x ?? 0), y: Math.round(f.ay ?? info?.r.y ?? 0), w: Math.round(f.w ?? info?.r.w ?? 0), h: info ? Math.round(info.r.h) : undefined, rot: 0, opacity: f.opacity ?? 1,
    text: getByEid(d, id), font: f.font ?? '', size: f.size ?? (cs ? Math.round(parseFloat(cs.fontSize)) : 12), bold: f.bold ?? (cs ? +cs.fontWeight >= 600 : false), italic: f.italic ?? cs?.fontStyle === 'italic', underline: f.underline ?? !!cs?.textDecorationLine.includes('underline'),
    align: f.align ?? 'left', lh: 1.3, ls: 0, color: f.color ?? (cs ? hex(type === 'rule' ? cs.backgroundColor : cs.color) : '#000000'), thickness: f.th ?? (cs ? parseFloat(cs.height) : 2), detachW: info?.detachW,
  }
}

export function writeProps(d: Data, cur: Props, p: Partial<Props>): Data {
  if (cur.kind === 'obj') {
    const m: Partial<Obj> = {}
    const set = <K extends keyof Obj>(k: K, v: Obj[K] | undefined) => { (m as Record<string, unknown>)[k] = v }
    if (p.x !== undefined) set('x', p.x); if (p.y !== undefined) set('y', p.y)
    if (p.w !== undefined) { set('w', p.w); if (cur.type === 'icon') set('h', p.w) }
    if (p.h !== undefined) set('h', p.h)
    if (p.rot !== undefined) set('rot', p.rot); if (p.opacity !== undefined) set('opacity', p.opacity); if (p.radius !== undefined) set('radius', p.radius)
    if (p.text !== undefined) set('text', p.text); if (p.size !== undefined) set('size', p.size)
    if (p.bold !== undefined) set('bold', p.bold); if (p.italic !== undefined) set('italic', p.italic); if (p.underline !== undefined) set('underline', p.underline)
    if (p.align !== undefined) set('align', p.align); if (p.lh !== undefined) set('lh', p.lh); if (p.ls !== undefined) set('ls', p.ls)
    if (p.font !== undefined) set('font', FONTS[p.font]?.[1] || undefined)
    if (p.color !== undefined) set(cur.type === 'icon' ? 'stroke' : 'color', p.color)
    if (p.fill !== undefined) set('fill', p.fill); if (p.stroke !== undefined) set('stroke', p.stroke); if (p.sw !== undefined) set('sw', p.sw)
    if (p.thickness !== undefined) set('thickness', p.thickness); if (p.dash !== undefined) set('dash', p.dash); if (p.fit !== undefined) set('fit', p.fit)
    return patchObjs(d, { [cur.id]: m })
  }
  let out = d
  if (p.x !== undefined || p.y !== undefined || p.w !== undefined) out = applyGeo(out, [{ id: cur.id, x: p.x ?? cur.x, y: p.y ?? cur.y, w: p.w, detachW: cur.detachW }])
  const f: Fmt = {}
  if ('font' in p) f.font = p.font || undefined
  if (p.size !== undefined) f.size = p.size; if (p.bold !== undefined) f.bold = p.bold; if (p.italic !== undefined) f.italic = p.italic; if (p.underline !== undefined) f.underline = p.underline
  if (p.align !== undefined) f.align = p.align; if (p.opacity !== undefined) f.opacity = p.opacity; if (p.color !== undefined) f.color = p.color; if (p.thickness !== undefined) f.th = p.thickness
  if (Object.keys(f).length) out = patchFmt(out, cur.id, f)
  if (p.text !== undefined) { const x = structuredClone(out); if (setByEid(x, cur.id, p.text)) out = x }
  return out
}
