// Pointer interactions of the design canvas: drag (multi), resize, rotate, draw, marquee, selection rules.
import type { PointerEvent as RPE } from 'react'
import { intersects, snapEdge, snapMove, union } from '../core/geometry'
import type { Ctx } from '../render/context'
import { blurActive, candidates, findNode, nodeId, nodeInfo, NODE_SEL, pageOf, relRect, type NodeInfo } from './dom'

/** Coalesce high-frequency pointer work into one update per animation frame (keeps dragging smooth). */
function frame<A extends unknown[]>(fn: (...a: A) => void) {
  let a: A | null = null, raf = 0
  return {
    push(...x: A) { a = x; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (a) { const y = a; a = null; fn(...y) } }) },
    flush() { cancelAnimationFrame(raf); raf = 0; if (a) { const y = a; a = null; fn(...y) } },
  }
}
const track = (mv: (e: PointerEvent) => void, end: () => void) => {
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); end() }
  addEventListener('pointermove', mv); addEventListener('pointerup', up)
}
let lastTap = { id: '', t: 0 }
const isDoubleTap = (id: string) => { const now = Date.now(), hit = lastTap.id === id && now - lastTap.t < 350; lastTap = hit ? { id: '', t: 0 } : { id, t: now }; return hit }

/** Drag the selection. Shift locks the movement to one axis. */
export function startDrag(e: RPE, c: Ctx, ids: string[], clickedId: string, additive: boolean) {
  const infos = ids.map((id) => nodeInfo(id, c.scale)).filter((n): n is NodeInfo => !!n)
  if (!infos.length) return
  const pg = infos[0].el.closest<HTMLElement>('.page')!, box = union(infos.map((i) => i.r)), cand = candidates(pg, c.scale, new Set(infos.map((i) => i.el)))
  const x0 = e.clientX, y0 = e.clientY, tol = 6 / c.scale; let moved = false
  const f = frame((dx: number, dy: number, shift: boolean) => {
    if (shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
    const s = c.snap.on ? snapMove(box, dx, dy, cand, tol, c.snap.grid) : { dx: Math.round(dx), dy: Math.round(dy), gv: [] as number[], gh: [] as number[] }
    c.setGuides({ pg: infos[0].pi, v: s.gv, h: s.gh })
    c.geo(infos.map((i) => ({ id: i.id, x: Math.round(i.r.x + s.dx), y: Math.round(i.r.y + s.dy), detachW: i.detachW })))
  })
  track((ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return
    if (!moved) c.gesture()
    moved = true; f.push((ev.clientX - x0) / c.scale, (ev.clientY - y0) / c.scale, ev.shiftKey)
  }, () => { f.flush(); c.setGuides(null); if (!moved && !additive && ids.length > 1) c.pick(clickedId) })
}

/** Resize a template element (width only: text, tags, dividers). */
export function startResize(e: RPE, c: Ctx, id: string, dir: string) {
  const n = nodeInfo(id, c.scale)
  if (!n) return
  const cand = candidates(n.el.closest<HTMLElement>('.page')!, c.scale, new Set([n.el])), r = n.r, x0 = e.clientX, tol = 6 / c.scale, grid = c.snap.on ? c.snap.grid : 0
  c.gesture()
  const f = frame((dx: number) => {
    const gv: number[] = [], sx = (v: number) => (c.snap.on ? snapEdge(v, cand.X, tol, grid, gv) : v)
    let x = r.x, w = r.w
    if (dir.includes('e')) w = Math.max(6, sx(r.x + r.w + dx) - r.x)
    if (dir.includes('w')) { const nx = Math.min(sx(r.x + dx), r.x + r.w - 6); w = r.x + r.w - nx; x = nx }
    c.setGuides({ pg: n.pi, v: gv, h: [] }); c.geo([{ id, x: Math.round(x), y: Math.round(r.y), w: Math.round(w) }])
  })
  track((ev) => f.push((ev.clientX - x0) / c.scale), () => { f.flush(); c.setGuides(null) })
}

type Box = { id: string; type: string; x: number; y: number; w: number; h: number; rot: number }
/** Resize a free object. Works for rotated objects; Shift keeps the aspect ratio on corners. */
export function startResizeObj(e: RPE, c: Ctx, o: Box, dir: string) {
  const line = o.type === 'line', onlyW = line || o.type === 'text', rad = (o.rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad)
  const el = findNode(o.id), pg = el?.closest<HTMLElement>('.page'), x0 = e.clientX, y0 = e.clientY, tol = 6 / c.scale, grid = c.snap.on ? c.snap.grid : 0
  const cand = pg && el && o.rot === 0 && !line ? candidates(pg, c.scale, new Set([el])) : null
  c.gesture()
  const f = frame((dx: number, dy: number, shift: boolean) => {
    const ldx = dx * cos + dy * sin, ldy = -dx * sin + dy * cos, gv: number[] = [], gh: number[] = []
    let w = o.w, h = o.h
    if (dir.includes('e')) w = o.w + ldx
    if (dir.includes('w')) w = o.w - ldx
    if (dir.includes('s')) h = o.h + ldy
    if (dir.includes('n')) h = o.h - ldy
    if (shift && dir.length === 2) { const ar = o.w / o.h; if (Math.abs(w / o.w) >= Math.abs(h / o.h)) h = w / ar; else w = h * ar }
    w = Math.max(line ? 4 : 6, w); h = Math.max(2, h)
    const lx = dir.includes('e') ? (w - o.w) / 2 : dir.includes('w') ? -(w - o.w) / 2 : 0, ly = dir.includes('s') ? (h - o.h) / 2 : dir.includes('n') ? -(h - o.h) / 2 : 0
    let x = o.x + o.w / 2 + lx * cos - ly * sin - w / 2, y = o.y + o.h / 2 + lx * sin + ly * cos - h / 2
    if (line) { x = dir.includes('w') ? o.x + (o.w - w) * cos : o.x; y = dir.includes('w') ? o.y + (o.w - w) * sin : o.y }
    if (cand && c.snap.on) {
      if (dir.includes('e')) { const r = snapEdge(x + w, cand.X, tol, grid, gv); w = r - x }
      if (dir.includes('w')) { const l = snapEdge(x, cand.X, tol, grid, gv); w = x + w - l; x = l }
      if (dir.includes('s')) { const b = snapEdge(y + h, cand.Y, tol, grid, gh); h = b - y }
      if (dir.includes('n')) { const t = snapEdge(y, cand.Y, tol, grid, gh); h = y + h - t; y = t }
    }
    c.setGuides({ pg: pg ? pageOf(pg.firstElementChild ?? pg) : 0, v: gv, h: gh })
    c.patchObj(o.id, onlyW ? { x: Math.round(x), y: Math.round(y), w: Math.round(w) } : { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) })
  })
  track((ev) => f.push((ev.clientX - x0) / c.scale, (ev.clientY - y0) / c.scale, ev.shiftKey), () => { f.flush(); c.setGuides(null) })
}

/** Rotate a free object around its centre (Shift snaps to 15°). */
export function startRotate(e: RPE, c: Ctx, id: string, rot0: number) {
  const el = findNode(id)
  if (!el) return
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a0 = Math.atan2(e.clientY - cy, e.clientX - cx)
  c.gesture()
  const f = frame((x: number, y: number, shift: boolean) => {
    let rot = rot0 + ((Math.atan2(y - cy, x - cx) - a0) * 180) / Math.PI
    if (shift) rot = Math.round(rot / 15) * 15
    rot = Math.round(((rot % 360) + 540) % 360) - 180
    c.patchObj(id, { rot })
  })
  track((ev) => f.push(ev.clientX, ev.clientY, ev.shiftKey), () => f.flush())
}

/** Rubber-band selection on a page. Shift/Ctrl adds to the current selection. */
export function startMarquee(e: RPE, c: Ctx, pg: HTMLElement, pi: number) {
  const add = e.shiftKey || e.metaKey || e.ctrlKey, base = add ? c.sel : [], p = pg.getBoundingClientRect(), sx = (e.clientX - p.left) / c.scale, sy = (e.clientY - p.top) / c.scale; let moved = false
  const f = frame((x: number, y: number) => {
    const r = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) }
    c.setMarquee({ pg: pi, ...r })
    const hit = Array.from(pg.querySelectorAll<HTMLElement>(NODE_SEL)).filter((el) => !el.dataset.locked && intersects(r, relRect(el, pg, c.scale))).map(nodeId)
    c.select(Array.from(new Set([...base, ...hit])))
  })
  track((ev) => {
    const x = (ev.clientX - p.left) / c.scale, y = (ev.clientY - p.top) / c.scale
    if (!moved && Math.hypot(x - sx, y - sy) < 4 / c.scale) return
    moved = true; f.push(x, y)
  }, () => { f.flush(); c.setMarquee(null); if (!moved && !add) c.pick(null) })
}

/** Draw a new shape / text box with the active tool (drag to size, click for a default size). */
export function startDraw(e: RPE, c: Ctx, pg: HTMLElement, pi: number) {
  const tool = c.tool, p = pg.getBoundingClientRect(), g = c.snap.on ? c.snap.grid : 1
  const sx = Math.round((e.clientX - p.left) / c.scale / g) * g, sy = Math.round((e.clientY - p.top) / c.scale / g) * g
  const id = c.beginDraw(pi, tool, sx, sy); let moved = false
  const f = frame((x: number, y: number, shift: boolean) => {
    let w = Math.round(x / g) * g - sx, h = Math.round(y / g) * g - sy
    if (tool === 'line') { let ang = (Math.atan2(h, w) * 180) / Math.PI; if (shift) ang = Math.round(ang / 15) * 15; c.patchObj(id, { w: Math.max(1, Math.round(Math.hypot(w, h))), rot: Math.round(ang) }); return }
    if (shift && tool !== 'text') { const m = Math.max(Math.abs(w), Math.abs(h)); w = (w < 0 ? -1 : 1) * m; h = (h < 0 ? -1 : 1) * m }
    const nx = Math.min(sx, sx + w), ny = Math.min(sy, sy + h)
    c.patchObj(id, tool === 'text' ? { x: nx, w: Math.max(20, Math.abs(w)) } : { x: nx, y: ny, w: Math.max(1, Math.abs(w)), h: Math.max(1, Math.abs(h)) })
  })
  track((ev) => {
    const x = (ev.clientX - p.left) / c.scale - 0, y = (ev.clientY - p.top) / c.scale
    if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return
    moved = true; f.push(x, y, ev.shiftKey)
  }, () => {
    f.flush()
    if (!moved) c.patchObj(id, tool === 'line' ? { w: 120 } : tool === 'text' ? { w: 200 } : { w: 100, h: 100 })
    c.select([id]); c.setTool('move'); if (tool === 'text') c.edit(id)
  })
}

/** Press on a template element or free object: select, drag, or double-tap to edit text. */
export function nodePointerDown(e: RPE<HTMLElement>, c: Ctx, id: string) {
  if (e.button !== 0 || c.hand || c.tool !== 'move') return // pan / draw tools are handled by the viewport and the page
  const el = e.currentTarget
  if (el.dataset.locked) return // locked elements behave like background
  e.stopPropagation(); e.preventDefault(); blurActive(); c.setPage(pageOf(el))
  const add = e.shiftKey || e.metaKey || e.ctrlKey
  if (add) { c.pick(id, true); return }
  const already = c.sel.includes(id), ids = already ? c.sel : c.expand([id])
  if (!already) c.pick(id)
  if (ids.length === 1 && isDoubleTap(id)) { c.edit(id); return }
  startDrag(e, c, ids, id, add)
}
export function pagePointerDown(e: RPE<HTMLElement>, c: Ctx, pi: number) {
  if (e.button !== 0 || c.hand) return
  blurActive(); c.setPage(pi)
  if (c.tool !== 'move') { startDraw(e, c, e.currentTarget, pi); return }
  startMarquee(e, c, e.currentTarget, pi)
}
