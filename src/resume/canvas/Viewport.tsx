// Scrollable, zoomable canvas viewport.
//  - Ctrl/Cmd + mouse wheel (or trackpad pinch) zooms around the cursor
//  - right mouse drag, middle mouse drag, or Space + drag pans (like EasyEDA / Figma)
//  - Fit / 100% / zoom buttons and Ctrl + / - / 0 / 1 shortcuts work through `apiRef`
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode, type PointerEvent as RPE } from 'react'
import { PW } from '../core/geometry'

export type ZoomState = ReturnType<typeof useZoom>
export function useZoom() {
  const [zoom, setZoom] = useState<number | 'fit'>('fit'), [fit, setFit] = useState(1)
  const z = zoom === 'fit' ? fit : zoom
  const set = (n: number | 'fit') => setZoom(n === 'fit' ? 'fit' : Math.min(4, Math.max(0.25, n)))
  return { z, zoom, fit, setFit, set }
}
export type VPApi = { zoomBy: (f: number) => void; actual: () => void; fit: () => void }

export function Viewport({ zoom, design, hand, cursor, apiRef, onBlank, onContext, overlay, children }: { zoom: ZoomState; design: boolean; hand: boolean; cursor?: string; apiRef: MutableRefObject<VPApi | null>; onBlank: () => void; onContext: (x: number, y: number) => void; overlay?: ReactNode; children: ReactNode }) {
  const pane = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ cx: number; cy: number; mx: number; my: number } | null>(null)
  const [ih, setIh] = useState(1123), [panning, setPanning] = useState(false)
  const { z, setFit } = zoom

  useEffect(() => { // fit-to-width
    const el = pane.current!, ro = new ResizeObserver(() => setFit(Math.min(1, Math.max(0.3, (el.clientWidth - 48) / PW))))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  useEffect(() => { const el = inner.current!, ro = new ResizeObserver(() => setIh(el.offsetHeight)); ro.observe(el); return () => ro.disconnect() }, [])

  const zoomAt = (nz: number, px?: number, py?: number) => {
    const p = pane.current!, b = box.current!, pr = p.getBoundingClientRect(), br = b.getBoundingClientRect()
    const x = px ?? pr.left + p.clientWidth / 2, y = py ?? pr.top + p.clientHeight / 2
    anchor.current = { cx: (x - br.left) / z, cy: (y - br.top) / z, mx: x - pr.left, my: y - pr.top }
    zoom.set(nz)
  }
  useLayoutEffect(() => { // keep the point under the cursor fixed after the zoom changes
    const a = anchor.current, p = pane.current, b = box.current
    if (!a || !p || !b) return
    anchor.current = null
    p.scrollLeft = b.offsetLeft + a.cx * z - a.mx; p.scrollTop = b.offsetTop + a.cy * z - a.my
  }, [z])
  apiRef.current = { zoomBy: (f) => zoomAt(z * f), actual: () => zoomAt(1), fit: () => zoom.set('fit') }

  useEffect(() => {
    const el = pane.current!
    const wheel = (e: WheelEvent) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(z * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  })

  const down = (e: RPE<HTMLDivElement>) => {
    if (!(e.button === 1 || e.button === 2 || (e.button === 0 && hand))) return
    e.preventDefault()
    const el = pane.current!, x0 = e.clientX, y0 = e.clientY, sl = el.scrollLeft, st = el.scrollTop, right = e.button === 2; let moved = false
    setPanning(true)
    const mv = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 4) moved = true; el.scrollLeft = sl - (ev.clientX - x0); el.scrollTop = st - (ev.clientY - y0) }
    const up = (ev: PointerEvent) => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); setPanning(false); if (right && !moved) onContext(ev.clientX, ev.clientY) } // right click without dragging opens the menu
    addEventListener('pointermove', mv); addEventListener('pointerup', up)
  }
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col print:block">
      <div ref={pane} onPointerDown={down} onContextMenu={design ? (e) => e.preventDefault() : undefined}
        className="canvas-bg min-h-0 flex-1 overflow-auto print:block print:overflow-visible print:bg-white"
        style={{ cursor: panning ? 'grabbing' : cursor, touchAction: design ? 'none' : undefined }}>
        <div className="flex min-w-full justify-center p-2 sm:p-6 print:p-0" style={{ width: 'max-content' }} onPointerDown={(e) => { if (e.button === 0 && !hand && e.target === e.currentTarget) onBlank() }}>
          <div ref={box} className="zw" style={{ width: PW * z, height: ih * z }}>
            <div ref={inner} className="zs" style={{ width: PW, transform: `scale(${z})`, transformOrigin: 'top left' }}>{children}</div>
          </div>
        </div>
      </div>
      {overlay}
    </div>
  )
}
