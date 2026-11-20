// Pure geometry helpers (no DOM): snapping, alignment, distribution.
export type Rect = { x: number; y: number; w: number; h: number }
export const PW = 794, PH = 1123, MARG = 45
export const PAGE: Rect = { x: 0, y: 0, w: PW, h: PH }

export const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}
export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export type Cands = { X: number[]; Y: number[] }
export const baseCands = (): Cands => ({ X: [0, PW / 2, PW, MARG, PW - MARG], Y: [0, PH / 2, PH, MARG, PH - MARG] })

export function near(vals: number[], cs: number[], tol: number) {
  let best: { d: number; c: number } | null = null
  for (const v of vals) for (const c of cs) { const d = c - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, c } }
  return best
}

/** Snap a moving rectangle to guide candidates, falling back to a grid (grid = 0 disables it). */
export function snapMove(r: Rect, dx: number, dy: number, c: Cands, tol: number, grid: number) {
  const gv: number[] = [], gh: number[] = []
  const bx = near([r.x + dx, r.x + dx + r.w / 2, r.x + dx + r.w], c.X, tol), by = near([r.y + dy, r.y + dy + r.h / 2, r.y + dy + r.h], c.Y, tol)
  if (bx) { dx += bx.d; gv.push(bx.c) } else if (grid) dx = Math.round((r.x + dx) / grid) * grid - r.x
  if (by) { dy += by.d; gh.push(by.c) } else if (grid) dy = Math.round((r.y + dy) / grid) * grid - r.y
  return { dx, dy, gv, gh }
}
export function snapEdge(v: number, cs: number[], tol: number, grid: number, guides: number[]) {
  const b = near([v], cs, tol)
  if (b) { guides.push(b.c); return b.c }
  return grid ? Math.round(v / grid) * grid : v
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
type Item = { id: string; r: Rect }
/** New top-left positions that align items to each other (or to `bounds`, e.g. the page, for a single item). */
export function alignPositions(items: Item[], mode: AlignMode, bounds?: Rect) {
  const b = bounds ?? union(items.map((i) => i.r))
  return items.map(({ id, r }) => ({
    id,
    x: mode === 'left' ? b.x : mode === 'right' ? b.x + b.w - r.w : mode === 'hcenter' ? b.x + (b.w - r.w) / 2 : r.x,
    y: mode === 'top' ? b.y : mode === 'bottom' ? b.y + b.h - r.h : mode === 'vcenter' ? b.y + (b.h - r.h) / 2 : r.y,
  }))
}
/** Equal gaps between items along one axis (needs 3+ items). */
export function distributePositions(items: Item[], axis: 'h' | 'v') {
  const [k, sz] = axis === 'h' ? (['x', 'w'] as const) : (['y', 'h'] as const)
  const s = [...items].sort((a, b) => a.r[k] - b.r[k]), last = s[s.length - 1]
  const gap = (last.r[k] + last.r[sz] - s[0].r[k] - s.reduce((a, i) => a + i.r[sz], 0)) / (s.length - 1)
  let pos = s[0].r[k]
  return s.map(({ id, r }) => { const out = { id, x: axis === 'h' ? pos : r.x, y: axis === 'v' ? pos : r.y }; pos += r[sz] + gap; return out })
}
