import { useContext, useEffect, useRef, type CSSProperties } from 'react'
import { MARG, PH, PW } from '../core/geometry'
import type { Obj } from '../core/data'
import { fontCss } from '../core/fonts'
import { Cx } from '../render/context'
import { md } from '../render/text'
import { ALL_DIRS, Handles, RotateZones } from './Handles'
import { blurActive, nodeInfo, type NodeInfo } from './dom'
import { union } from '../core/geometry'
import { nodePointerDown, startResizeObj, startRotate } from './interactions'

function textStyle(o: Obj): CSSProperties {
  return { width: o.w, fontSize: o.size ?? 14, color: o.color ?? '#111827', fontWeight: o.bold ? 700 : 400, fontStyle: o.italic ? 'italic' : 'normal', textDecoration: o.underline ? 'underline' : 'none', textAlign: o.align ?? 'left', fontFamily: o.font || fontCss(undefined), lineHeight: o.lh ?? 1.3, letterSpacing: o.ls ? `${o.ls}px` : undefined, textTransform: o.caps === 'upper' ? 'uppercase' : undefined, fontVariant: o.caps === 'small' ? 'small-caps' : undefined, whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: o.opacity ?? 1 }
}
function ObjBody({ o }: { o: Obj }) {
  const op = o.opacity ?? 1
  if (o.type === 'text') return <div style={textStyle(o)}>{md(o.text || '', o.color || '#1d4ed8')}</div>
  if (o.type === 'line') return <div style={{ padding: '6px 0', margin: '-6px 0' }}><div data-lb="1" style={{ width: o.w, height: 0, borderTop: `${o.thickness ?? 2}px ${o.dash ? 'dashed' : 'solid'} ${o.color ?? '#111827'}`, opacity: op }} /></div>
  if (o.type === 'rect') return <div style={{ width: o.w, height: o.h ?? 50, background: o.fill || 'transparent', border: o.sw ? `${o.sw}px solid ${o.stroke || '#111827'}` : undefined, borderRadius: o.radius, boxSizing: 'border-box', opacity: op }} />
  if (o.type === 'icon') return <svg width={o.w} height={o.h ?? o.w} viewBox="0 0 24 24" fill="none" stroke={o.stroke || '#111827'} strokeWidth={o.sw ?? 2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', opacity: op }}><path d={o.path || ''} /></svg>
  return o.src ? <img src={o.src} alt="" draggable={false} style={{ width: o.w, height: o.h ?? 100, objectFit: o.fit ?? 'cover', display: 'block', borderRadius: o.radius, opacity: op }} /> : <div style={{ width: o.w, height: o.h ?? 100, background: '#e2e8f0' }} />
}
const wrap = (o: Obj): CSSProperties => ({ position: 'absolute', left: o.x, top: o.y, transform: o.rot ? `rotate(${o.rot}deg)` : undefined, transformOrigin: o.type === 'line' ? '0 0' : '50% 50%' })

function TextEdit({ o, done }: { o: Obj; done: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null), fin = useRef(false)
  useEffect(() => { const el = ref.current!; el.textContent = o.text || ''; el.focus(); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r) }, [])
  return <div ref={ref} contentEditable suppressContentEditableWarning spellCheck={false} onPointerDown={(e) => e.stopPropagation()} onBlur={(e) => { if (fin.current) return; fin.current = true; done(e.currentTarget.innerText.replace(/\n$/, '')) }} onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }} style={{ ...textStyle(o), outline: 'none', minHeight: '1em' }} />
}

/** Free objects of one page (drawn above the template content) plus the editing chrome: guides, grid, margins, marquee. */
export function OverlayLayer({ pi, objs }: { pi: number; objs: Obj[] }) {
  const c = useContext(Cx)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {c.on && c.view.grid && <div className="cv-ui" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(99,102,241,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,.14) 1px, transparent 1px)', backgroundSize: `${c.snap.grid * 4}px ${c.snap.grid * 4}px` }} />}
      {c.on && c.view.margins && <div className="cv-ui" style={{ position: 'absolute', left: MARG, top: MARG, width: PW - 2 * MARG, height: PH - 2 * MARG, border: '1px dashed rgba(244,63,94,.45)' }} />}
      {objs.map((o) => {
        if (o.hidden) return null
        if (!c.on) return <div key={o.id} style={wrap(o)}><ObjBody o={o} /></div>
        const selected = c.sel.includes(o.id), only = selected && c.sel.length === 1, editing = c.editing === o.id
        return (
          <div key={o.id} data-oid={o.id} data-line={o.type === 'line' ? '1' : undefined} data-locked={o.locked ? '1' : undefined} className={selected ? '' : 'cv-obj'}
            style={{ ...wrap(o), pointerEvents: o.locked ? 'none' : 'auto', cursor: editing ? 'text' : 'move', touchAction: 'none', outline: selected ? '1px solid #0d99ff' : undefined }}
            onPointerDown={(e) => { if (!editing) nodePointerDown(e, c, o.id) }}>
            {editing ? <TextEdit o={o} done={(v) => { c.edit(null); if (v !== o.text) c.patchObj(o.id, { text: v }) }} /> : <ObjBody o={o} />}
            {only && !editing && <>
              <Handles dirs={o.type === 'text' || o.type === 'line' ? ['e', 'w'] : ALL_DIRS} scale={c.scale} onDown={(e, dir) => startResizeObj(e, c, { id: o.id, type: o.type, x: o.x, y: o.y, w: o.w, h: o.type === 'text' ? (e.currentTarget.parentElement?.offsetHeight ?? 20) : o.type === 'line' ? o.thickness ?? 2 : o.h ?? 50, rot: o.rot ?? 0 }, dir)} />
              {o.type !== 'line' && <RotateZones scale={c.scale} onDown={(e) => startRotate(e, c, o.id, o.rot ?? 0)} />}
            </>}
          </div>
        )
      })}
      <SelectionChrome pi={pi} />
      {c.guides?.pg === pi && <>{c.guides.v.map((x, i) => <div key={'v' + i} className="cv-ui" style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, background: '#f43f5e' }} />)}{c.guides.h.map((y, i) => <div key={'h' + i} className="cv-ui" style={{ position: 'absolute', top: y, left: 0, right: 0, height: 1, background: '#f43f5e' }} />)}</>}
      {c.marquee?.pg === pi && <div className="cv-ui" style={{ position: 'absolute', left: c.marquee.x, top: c.marquee.y, width: c.marquee.w, height: c.marquee.h, background: 'rgba(99,102,241,.12)', border: '1px solid #6366f1' }} />}
    </div>
  )
}
export { blurActive }

/** Blue bounding box for multi-selections and the "W × H" badge under the selection. Reads layout from the DOM on every render. */
function SelectionChrome({ pi }: { pi: number }) {
  const c = useContext(Cx)
  if (!c.on || !c.sel.length) return null
  const infos = c.sel.map((id) => nodeInfo(id, c.scale)).filter((n): n is NodeInfo => !!n && n.pi === pi)
  if (!infos.length) return null
  const b = union(infos.map((i) => i.r)), px = 1 / c.scale
  return (
    <>
      {infos.length > 1 && <div className="cv-ui" style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, outline: `${px}px solid #0d99ff` }} />}
      <div className="cv-ui" style={{ position: 'absolute', left: b.x + b.w / 2, top: b.y + b.h + 8 * px, transform: `translateX(-50%) scale(${px})`, transformOrigin: 'top center', background: '#0d99ff', color: '#fff', fontSize: 11, lineHeight: '16px', padding: '0 6px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{Math.round(b.w)} × {Math.round(b.h)}</div>
    </>
  )
}
