// Selectable building blocks of the resume: text (T), tag lists (Tags) and divider lines (Rule).
// Once an element has `ax/ay` it is absolutely positioned and a hidden "ghost" stays in the flow,
// so editing one element never changes the size or position of any other.
import { useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent as RME, type PointerEvent as RPE } from 'react'
import { Handles } from '../canvas/Handles'
import { nodePointerDown, startResize } from '../canvas/interactions'
import { Cx, type Ctx } from './context'
import { fmtStyle, md, selStyle } from './text'
import { InlineBar, toHtml, toMarkup } from './inline'

function nodeProps(c: Ctx, id: string, attr: 'data-eid' | 'data-rule', locked?: boolean) {
  const selected = c.sel.includes(id)
  return {
    selected, only: selected && c.sel.length === 1,
    props: { [attr]: id, 'data-locked': locked ? '1' : undefined, className: selected ? 'selbox' : 'eh', onPointerDown: (e: RPE<HTMLElement>) => nodePointerDown(e, c, id), onClick: (e: RME) => { e.preventDefault(); e.stopPropagation() } },
  }
}
const grips = (c: Ctx, id: string) => <Handles dirs={['w', 'e']} scale={c.scale} onDown={(e, dir) => startResize(e, c, id, dir)} />

function Sel({ id, text, st, lead }: { id: string; text: string; st: CSSProperties; lead?: ReactNode }) {
  const c = useContext(Cx), ref = useRef<HTMLSpanElement>(null), done = useRef(false), multi = /\.(text|tags)$/.test(id), [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const e = ref.current; if (!e) return
    e.innerHTML = toHtml(text); setEl(e); e.focus()
    const r = document.createRange(); r.selectNodeContents(e); r.collapse(false)
    const s = getSelection(); s?.removeAllRanges(); s?.addRange(r)
  }, [])
  const finish = (e: HTMLElement) => { if (done.current) return; done.current = true; let v = toMarkup(e).replace(/\n+$/, ''); if (!multi) v = v.replace(/\n+/g, ' '); c.commit(id, v); c.edit(null) }
  return (
    <span data-eid={id} className="selbox" style={selStyle(st)}>
      {lead}
      <span ref={ref} contentEditable suppressContentEditableWarning spellCheck={false} style={{ outline: 'none' }} onPointerDown={(e) => e.stopPropagation()}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }}
        onBlur={(e) => { if ((e.relatedTarget as HTMLElement | null)?.closest('[data-inline-toolbar]')) return; finish(e.currentTarget) }} onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !multi && !e.shiftKey)) { e.preventDefault(); e.currentTarget.blur() } }} />
      <InlineBar target={el} />
    </span>
  )
}

export function T({ id, text, a, lead, bullet, href }: { id: string; text: string; a: string; lead?: ReactNode; bullet?: boolean; href?: string }) {
  const c = useContext(Cx), f = c.fmt[id]
  if (f?.hidden) return null
  const st = fmtStyle(f), moved = f?.ax !== undefined || !!f?.dx || !!f?.dy
  // a moved bullet carries its own marker (the list's marker would stay behind)
  const mark = bullet && moved ? <span aria-hidden style={{ position: 'absolute', left: -14, top: 0 }}>•</span> : null
  const content = <>{lead}{md(text, a)}</>
  const ghost = f?.ax !== undefined ? <span aria-hidden style={{ visibility: 'hidden' }}>{content}</span> : null
  const movedStyle = mark ? { ...st, position: st.position || 'relative' } : st
  if (!c.on) return <>{ghost}{href ? <a data-eid={id} href={href} target="_blank" rel="noreferrer" style={movedStyle}>{mark}{content}</a> : <span data-eid={id} style={movedStyle}>{mark}{content}</span>}</>
  if (c.editing === id) return <>{ghost}<Sel id={id} text={text} st={st} lead={lead} /></>
  const { selected, only, props } = nodeProps(c, id, 'data-eid', f?.locked)
  const style = selected ? selStyle(st) : movedStyle
  return <>{ghost}{href ? <a {...props} href={href} target="_blank" rel="noreferrer" style={style}>{mark}{lead}{md(text || ' ', a)}{only && grips(c, id)}</a> : <span {...props} style={style}>{mark}{lead}{md(text || ' ', a)}{only && grips(c, id)}</span>}</>
}

/** A list item whose bullet moves together with its text. */
export function Li({ id, text, a, mb = 0 }: { id: string; text: string; a: string; mb?: number }) {
  const f = useContext(Cx).fmt[id], gone = !!(f?.hidden || f?.ax !== undefined || f?.dx || f?.dy)
  return <li style={{ marginBottom: mb, listStyleType: gone ? 'none' : undefined }}><T id={id} text={text} a={a} bullet /></li>
}

export function Tags({ id, tags, size, dark }: { id: string; tags: string; size: number; dark: boolean }) {
  const c = useContext(Cx), f = c.fmt[id]
  if (f?.hidden) return null
  const st = fmtStyle(f), al = f?.align, row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 6px', paddingBottom: 6, justifyContent: al === 'center' ? 'center' : al === 'right' ? 'flex-end' : undefined }
  const chips = tags.split(',').map((x) => x.trim()).filter(Boolean).map((x, i) => <span key={i} data-chip="1" style={{ border: `1px solid ${dark ? 'rgba(255,255,255,.45)' : '#d1d5db'}`, borderRadius: 999, padding: '1px 10px', fontSize: (st.fontSize as number) || size - 1 }}>{x}</span>)
  const ghost = f?.ax !== undefined ? <div aria-hidden style={{ ...row, visibility: 'hidden' }}>{chips}</div> : null
  const box = { ...st, ...row }
  if (!c.on) return <>{ghost}<div data-tags="1" data-eid={id} style={box}>{chips}</div></>
  if (c.editing === id) return <>{ghost}<div style={{ paddingBottom: 6 }}><Sel id={id} text={tags} st={st} /></div></>
  const { selected, only, props } = nodeProps(c, id, 'data-eid', f?.locked)
  return <>{ghost}<div data-tags="1" {...props} style={selected ? selStyle(box) : box}>{chips}{only && grips(c, id)}</div></>
}

export function Rule({ id, color, th }: { id: string; color: string; th: number }) {
  const c = useContext(Cx), f = c.fmt[id]
  if (f?.hidden) return null
  const h = f?.th ?? th, bg = f?.color || color, detached = f?.ax !== undefined
  const ghost = detached ? <div aria-hidden style={{ height: th }} /> : null
  const place: CSSProperties = detached
    ? { position: 'absolute', left: f.ax, top: (f.ay ?? 0) - (c.on ? 5 : 0), width: f.w, zIndex: 2, opacity: f.opacity }
    : { width: f?.w || undefined, opacity: f?.opacity, ...(f?.dx || f?.dy ? { position: 'relative', left: f.dx || 0, top: f.dy || 0 } : {}) }
  if (!c.on) return <>{ghost}<div data-rule={id} style={{ ...place, height: h, background: bg }} /></>
  const { selected, only, props } = nodeProps(c, id, 'data-rule', f?.locked)
  return (
    <>{ghost}
      <div {...props} data-line="1" style={{ ...place, padding: '5px 0', ...(detached ? {} : { margin: '-5px 0' }), ...(selected ? selStyle(place) : {}) }}>
        <div data-lb="1" style={{ height: h, background: bg }} />{only && grips(c, id)}
      </div>
    </>
  )
}
