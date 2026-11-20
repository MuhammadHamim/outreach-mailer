// Selection + design actions. All data changes go through pure ops in core/ops.ts.
import { useState, useRef } from 'react'
import type { Obj } from '../core/data'
import { ask, tell } from '../core/confirm'
import { alignPositions, distributePositions, PAGE, type AlignMode } from '../core/geometry'
import * as ops from '../core/ops'
import { readProps, writeProps, type Props } from '../canvas/adapter'
import { listNodes, nodeInfo, pages, type NodeInfo } from '../canvas/dom'
import { ICONS } from '../canvas/icons'
import type { DesignApi } from '../canvas/types'
import type { Ctx, Guides, Marquee, Tool, ViewOpts } from '../render'
import { shrinkImage } from './image'
import type { Doc } from './useDocument'

export function useDesign(doc: Doc, z: number) {
  const [design, setDesignOn] = useState(false), [space, setHand] = useState(false), [tool, setTool] = useState<Tool>('move')
  const hand = tool === 'hand' || space
  const [sel, setSel] = useState<string[]>([]), [editing, setEditing] = useState<string | null>(null)
  const [snap, setSnap] = useState({ on: true, grid: 4 }), [guides, setGuides] = useState<Guides>(null), [marquee, setMarquee] = useState<Marquee>(null)
  const [cpage, setPage] = useState(0), [view, setView] = useState<ViewOpts>({ grid: false, margins: true })
  const clip = useRef<Obj[]>([])
  const { edit, cur } = doc
  const pgIdx = () => Math.max(0, Math.min(cpage, pages().length - 1))
  const infos = () => sel.map((id) => nodeInfo(id, z)).filter((n): n is NodeInfo => !!n)

  // ----- selection (groups select together) -----
  const expand = (ids: string[]) => { const d = cur(), out = new Set(ids); ids.forEach((id) => { const g = ops.groupOf(d, id); if (g) ops.members(d, g).forEach((m) => out.add(m)) }); return Array.from(out) }
  const select = (ids: string[]) => { setEditing(null); setSel(expand(ids)) }
  const pick = (id: string | null, additive = false) => {
    setEditing(null)
    if (!id) { setSel([]); return }
    const e = expand([id])
    setSel((prev) => (additive ? (e.every((x) => prev.includes(x)) ? prev.filter((x) => !e.includes(x)) : Array.from(new Set([...prev, ...e]))) : e))
  }
  const editable = (id: string) => (ops.isObjId(id) ? ops.findObj(cur(), id)?.o.type === 'text' : !id.endsWith('.rule'))
  const startEdit = (id: string | null) => { if (id && !editable(id)) return; if (id) setSel([id]); setEditing(id) }
  const selectAll = () => select(listNodes(pgIdx()).filter((n) => !n.el.dataset.locked).map((n) => n.id))
  const clearSel = async () => { setSel([]); setEditing(null); await new Promise((r) => setTimeout(r, 90)) }

  // ----- geometry & style -----
  const geo = (items: ops.Geo[]) => edit((d) => ops.applyGeo(d, items), true)
  const patchObj = (id: string, p: Partial<Obj>) => edit((d) => ops.patchObjs(d, { [id]: p }), true)
  const upd = (p: Partial<Obj>) => { if (sel.length === 1 && ops.isObjId(sel[0])) patchObj(sel[0], p) }
  const setProps = (p: Partial<Props>) => { if (sel.length !== 1) return; const cp = readProps(cur(), sel[0], z); if (cp) edit((d) => writeProps(d, cp, p), true) }
  const nudge = (dx: number, dy: number) => { const n = infos(); if (n.length) geo(n.map((i) => ({ id: i.id, x: Math.round(i.r.x + dx), y: Math.round(i.r.y + dy), detachW: i.detachW }))) }
  const align = (m: AlignMode) => { const n = infos(); if (n.length) geo(alignPositions(n.map((i) => ({ id: i.id, r: i.r })), m, n.length === 1 ? PAGE : undefined).map((p) => ({ ...p, detachW: n.find((i) => i.id === p.id)?.detachW }))) }
  const distribute = (axis: 'h' | 'v') => { const n = infos(); if (n.length > 2) geo(distributePositions(n.map((i) => ({ id: i.id, r: i.r })), axis).map((p) => ({ ...p, detachW: n.find((i) => i.id === p.id)?.detachW }))) }

  // ----- edit actions -----
  const del = () => { if (!sel.length) return; edit((d) => ops.removeIds(d, sel)); setSel([]) }
  const dup = () => { const r = ops.duplicateObjs(cur(), sel.filter(ops.isObjId)); if (!r.ids.length) return; edit(() => r.data); setSel(r.ids) }
  const copy = () => { clip.current = sel.filter(ops.isObjId).map((id) => ops.findObj(cur(), id)!.o).filter(Boolean) }
  const paste = () => {
    if (!clip.current.length) return
    const g = new Map<string, string>()
    const objs = clip.current.map((o) => { let grp = o.grp; if (grp) { if (!g.has(grp)) g.set(grp, ops.newId()); grp = g.get(grp) } return { ...o, id: ops.objId(), grp, x: o.x + 16, y: o.y + 16 } })
    clip.current = objs.map((o) => ({ ...o })); edit((d) => ops.addObjs(d, pgIdx(), objs)); setSel(objs.map((o) => o.id))
  }
  const group = () => { if (sel.length > 1) edit((d) => ops.setGroup(d, sel, ops.newId())) }
  const ungroup = () => edit((d) => ops.setGroup(d, sel, undefined))
  const lock = (ids: string[], b: boolean) => { edit((d) => ops.lockMany(d, ids, b)); if (b) setSel((s) => s.filter((x) => !ids.includes(x))) }
  const hide = (ids: string[], b: boolean) => { edit((d) => ops.hideMany(d, ids, b)); if (b) setSel((s) => s.filter((x) => !ids.includes(x))) }
  const order = (k: 'front' | 'back' | 'up' | 'down') => edit((d) => ops.reorder(d, sel.filter(ops.isObjId), k))
  const style = (s: ops.StyleP) => edit((d) => ops.applyStyle(d, sel, s), true)
  const pageBg = (c: string) => edit((d) => ops.setPageBg(d, pgIdx(), c), true)
  const replaceImg = async (f: File) => { try { upd({ src: (await shrinkImage(f)).src }) } catch (e) { tell((e as Error).message) } }
  const resetAll = async () => { if (await ask('Reset every element edit (colours, sizes, positions, hidden items)? Free elements are kept.', 'Reset')) edit((d) => ({ ...d, fmt: undefined })) }

  // ----- insert -----
  const addObj = (o: Partial<Obj>) => { const id = ops.objId(); edit((d) => ops.addObjs(d, pgIdx(), [{ id, type: 'text', x: 60, y: 80, w: 240, ...o } as Obj])); setSel([id]) }
  const addSkill = () => { const g = ops.newId(), a = ops.objId(), b = ops.objId(); edit((d) => ops.addObjs(d, pgIdx(), [{ id: a, type: 'rect', x: 60, y: 120, w: 220, h: 8, fill: '#e5e5e5', radius: 999, grp: g }, { id: b, type: 'rect', x: 60, y: 120, w: 150, h: 8, fill: '#0d99ff', radius: 999, grp: g }])); setSel([a, b]) }
  const beginDraw = (pi: number, t: Tool, x: number, y: number) => {
    const id = ops.objId()
    const base: Partial<Obj> = t === 'rect' ? { type: 'rect', fill: '#d9d9d9', w: 1, h: 1 } : t === 'ellipse' ? { type: 'rect', fill: '#d9d9d9', radius: 999, w: 1, h: 1 } : t === 'line' ? { type: 'line', w: 1, thickness: 2, color: '#1e1e1e' } : { type: 'text', text: 'Type something', size: 16, color: '#1e1e1e', w: 200 }
    edit((d) => ops.addObjs(d, pi, [{ id, x, y, ...base } as Obj])); return id
  }
  const addImg = async (file: File, circle = false) => {
    try { const s = await shrinkImage(file), w = circle ? 110 : Math.min(220, s.w); addObj({ type: 'image', src: s.src, w, h: circle ? 110 : Math.round((w * s.h) / s.w), fit: 'cover', radius: circle ? 999 : undefined }) } catch (e) { tell((e as Error).message) }
  }
  const addIcon = (name: string) => addObj({ type: 'icon', path: ICONS[name], w: 22, h: 22, stroke: '#111827', sw: 2 })
  const addPage = () => { const n = pages().length; edit((d) => ops.addPage(d, n)); setPage(n) }
  const delPage = async (i: number) => {
    if (!pages()[i]?.hasAttribute('data-blank')) { tell('This page has resume content. Move or hide that content instead. Only empty pages can be deleted.'); return }
    if (await ask(`Delete blank page ${i + 1}?`)) { edit((d) => ops.delPage(d, i)); setPage(Math.max(0, i - 1)) }
  }

  const ctx: Partial<Ctx> = { on: design, hand, sel, editing, pick, select, expand, edit: startEdit, commit: doc.commit, geo, patchObj, snap, scale: z, guides, setGuides, marquee, setMarquee, setPage, view, tool, setTool, beginDraw, gesture: doc.breakHistory }
  const api: DesignApi = {
    sel, cpage: pgIdx(), tool, setTool, setPage, pick, select, selectAll, setProps, setFmt: (id, p) => edit((d) => ops.patchFmt(d, id, p)), clearFmt: (id) => edit((d) => ops.clearFmt(d, id)),
    style, del, dup, copy, paste, group, ungroup, lock, hide, order, align, distribute, pageBg, replaceImg, resetAll, addPage, delPage, snap, setSnap, view, setView,
  }
  const setDesign = (b: boolean) => { setDesignOn(b); setSel([]); setEditing(null); setTool('move') }
  return { design, setDesign, hand, setHand, tool, setTool, snap, setSnap, view, setView, editing, startEdit, ctx, api, nudge, clearSel, tools: { addImg, addIcon, addSkill, addPage, delPage } }
}
export type Design = ReturnType<typeof useDesign>
