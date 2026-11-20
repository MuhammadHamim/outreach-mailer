// DOM measurement helpers. All rectangles are returned in page coordinates (794 x 1123 design px), independent of zoom.
import { baseCands, type Cands, type Rect } from '../core/geometry'

export const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.()
export const pages = () => Array.from(document.querySelectorAll<HTMLElement>('#pages .page'))
export const pageOf = (el: Element) => pages().indexOf(el.closest('.page') as HTMLElement)
export const NODE_SEL = '[data-eid],[data-rule],[data-oid]'
export const nodeId = (el: HTMLElement) => el.dataset.eid ?? el.dataset.rule ?? el.dataset.oid ?? ''
// Only visible page content: the hidden measuring copy (used for pagination) carries the same ids.
export const findNode = (id: string) => document.querySelector<HTMLElement>(`#pages .page [data-eid="${id}"], #pages .page [data-rule="${id}"], #pages .page [data-oid="${id}"]`)
const body = (el: HTMLElement) => (el.dataset.line ? el.querySelector<HTMLElement>('[data-lb]') ?? el : el)

export function relRect(el: HTMLElement, pg: HTMLElement, scale: number): Rect {
  const r = body(el).getBoundingClientRect(), p = pg.getBoundingClientRect()
  return { x: (r.left - p.left) / scale, y: (r.top - p.top) / scale, w: r.width / scale, h: r.height / scale }
}

export type NodeInfo = { id: string; el: HTMLElement; pi: number; r: Rect; abs: boolean; detachW?: number }
export function nodeInfo(id: string, scale: number): NodeInfo | null {
  const el = findNode(id)
  if (!el) return null
  const pg = el.closest<HTMLElement>('.page')!, r = relRect(el, pg, scale), cs = getComputedStyle(el), abs = cs.position === 'absolute'
  let detachW: number | undefined
  if (!abs) { if (el.dataset.rule !== undefined || el.dataset.tags) detachW = r.w; else if (r.h > parseFloat(cs.fontSize) * 1.9) detachW = r.w } // keep wrapped text wrapped once it leaves the flow
  if (!abs && cs.display === 'inline') { const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2; if (r.h < lh * 1.5) r.y -= (lh - r.h) / 2 } // inline boxes sit in the middle of their line
  return { id, el, pi: pages().indexOf(pg), r, abs, detachW }
}

/** Snap targets on a page: page edges/centre/margins plus every other element's edges and centre. */
export function candidates(pg: HTMLElement, scale: number, skip: Set<HTMLElement>): Cands {
  const c = baseCands(), skipped = Array.from(skip)
  pg.querySelectorAll<HTMLElement>(NODE_SEL).forEach((q) => {
    if (skipped.some((s) => s === q || s.contains(q) || q.contains(s))) return
    const r = relRect(q, pg, scale)
    if (r.w < 1 && r.h < 1) return
    c.X.push(r.x, r.x + r.w / 2, r.x + r.w); c.Y.push(r.y, r.y + r.h / 2, r.y + r.h)
  })
  return c
}
export function listNodes(pi: number) {
  const pg = pages()[pi]
  if (!pg) return []
  return Array.from(pg.querySelectorAll<HTMLElement>(NODE_SEL)).filter((e) => !e.closest('.cv-ui')).map((el) => ({ id: nodeId(el), el }))
}

export const hex = (c: string) => { const m = c.match(/[\d.]+/g); if (!m || m.length < 3) return '#000000'; return '#' + m.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('') }
