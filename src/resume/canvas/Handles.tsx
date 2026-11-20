import type { PointerEvent as RPE } from 'react'

const HS: Record<string, [string, string, string]> = { nw: ['0%', '0%', 'nwse-resize'], n: ['50%', '0%', 'ns-resize'], ne: ['100%', '0%', 'nesw-resize'], e: ['100%', '50%', 'ew-resize'], se: ['100%', '100%', 'nwse-resize'], s: ['50%', '100%', 'ns-resize'], sw: ['0%', '100%', 'nesw-resize'], w: ['0%', '50%', 'ew-resize'] }
export const ALL_DIRS = Object.keys(HS)
const ROT_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'><path d='M21 12a9 9 0 11-3-6.700'/><path d='M21 4v5h-5'/></svg>") 10 10, grab`

/** Figma-style resize handles: small white squares with a blue border (hidden in print / PDF). */
export function Handles({ dirs, scale, onDown }: { dirs: string[]; scale: number; onDown: (e: RPE, dir: string) => void }) {
  const hs = Math.max(6, 8 / scale)
  return <>{dirs.map((d) => (
    <span key={d} className="cv-ui" onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onDown(e, d) }}
      style={{ position: 'absolute', left: HS[d][0], top: HS[d][1], width: hs, height: hs, margin: `${-hs / 2}px 0 0 ${-hs / 2}px`, background: '#fff', border: `${Math.max(1, 1 / scale)}px solid #0d99ff`, cursor: HS[d][2], zIndex: 6, touchAction: 'none', boxSizing: 'border-box' }} />
  ))}</>
}
/** Invisible zones just outside the corners; dragging them rotates the object (like Figma). */
export function RotateZones({ scale, onDown }: { scale: number; onDown: (e: RPE) => void }) {
  const s = 16 / scale, off = -s - 2 / scale
  const pos = [{ left: off, top: off }, { right: off, top: off }, { left: off, bottom: off }, { right: off, bottom: off }]
  return <>{pos.map((p, i) => <span key={i} className="cv-ui" onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onDown(e) }} style={{ position: 'absolute', width: s, height: s, cursor: ROT_CURSOR, zIndex: 5, touchAction: 'none', ...p }} />)}</>
}
