import type { CSSProperties, ReactNode } from 'react'
import type { Fmt } from '../core/data'
import { fontCss } from '../core/fonts'
import { MD_SPLIT, SPAN_RE, flagStyle } from './inline'

/** Tiny markup subset: **bold**, [text](url) and {{b i u c=#hex s=px|styled words}}. */
export const md = (s: string, a: string): ReactNode[] =>
  (s || '').split(MD_SPLIT).map((p, i) => {
    let m: RegExpMatchArray | null
    if ((m = p.match(/^\*\*(.+)\*\*$/))) return <strong key={i}>{md(m[1], a)}</strong>
    if ((m = p.match(SPAN_RE))) return <span key={i} style={flagStyle(m[1])}>{md(m[2], a)}</span>
    if ((m = p.match(/^\[(.+)\]\((.+)\)$/))) return <a key={i} href={m[2]} target="_blank" rel="noreferrer" style={{ color: a, textDecoration: 'underline' }}>{md(m[1], a)}</a>
    return p
  })

/** CSS for one element's formatting overrides. Elements with `ax` are absolutely positioned (independent of the flow). */
export function fmtStyle(f?: Fmt): CSSProperties {
  const s: CSSProperties = {}
  if (!f) return s
  if (f.color) s.color = f.color
  if (f.size) s.fontSize = f.size
  if (f.bold !== undefined) s.fontWeight = f.bold ? 700 : 400
  if (f.italic !== undefined) s.fontStyle = f.italic ? 'italic' : 'normal'
  if (f.underline) s.textDecoration = 'underline'
  if (fontCss(f.font)) s.fontFamily = fontCss(f.font)
  if (f.opacity !== undefined) s.opacity = f.opacity
  if (f.ax !== undefined) {
    Object.assign(s, { position: 'absolute', left: f.ax, top: f.ay ?? 0, display: 'block', zIndex: 2, whiteSpace: f.w ? 'pre-wrap' : 'nowrap' })
    if (f.w) s.width = f.w
    if (f.align) s.textAlign = f.align
  } else {
    if (f.align || f.w) { s.display = 'block'; if (f.align) s.textAlign = f.align; if (f.w) s.width = f.w }
    if (f.dx || f.dy) { s.position = 'relative'; s.left = f.dx || 0; s.top = f.dy || 0 }
  }
  return s
}
export const selStyle = (st: CSSProperties): CSSProperties => ({ ...st, position: st.position || 'relative', outline: '1px solid #0d99ff', outlineOffset: 1 })
