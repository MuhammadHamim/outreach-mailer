// Inline text styling (selected words only) for text that is edited in design mode.
// Stored inside the text as markup, so it works in the form, JSON and the PDF:
//   **bold**      {{b i u c=#dc2626 s=14|styled text}}   (b/i/u can be b=0 to switch a style OFF)
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

export const MD_SPLIT = /(\*\*[^*]+\*\*|\{\{[^|{}]*\|[\s\S]*?\}\}|\[[^\]]+\]\([^)]+\))/g
export const SPAN_RE = /^\{\{([^|{}]*)\|([\s\S]*)\}\}$/

export function flagStyle(flags: string): CSSProperties {
  const s: CSSProperties = {}
  for (const f of flags.trim().split(/\s+/)) {
    const [k, v] = f.split('=')
    if (k === 'b') s.fontWeight = v === '0' ? 400 : 700
    if (k === 'i') s.fontStyle = v === '0' ? 'normal' : 'italic'
    if (k === 'u') s.textDecoration = v === '0' ? 'none' : 'underline'
    if (k === 'c' && v) s.color = v
    if (k === 's' && v) s.fontSize = Number(v)
  }
  return s
}
const cssText = (flags: string) => Object.entries(flagStyle(flags)).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${typeof v === 'number' && k === 'fontSize' ? v + 'px' : v}`).join(';')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** markup -> HTML for the contentEditable editor. */
export function toHtml(text: string): string {
  return (text || '').split(MD_SPLIT).map((p) => {
    let m: RegExpMatchArray | null
    if ((m = p.match(/^\*\*(.+)\*\*$/))) return `<b>${esc(m[1])}</b>`
    if ((m = p.match(SPAN_RE))) return `<span style="${cssText(m[1])}">${toHtml(m[2])}</span>`
    if ((m = p.match(/^\[(.+)\]\((.+)\)$/))) return `<a href="${esc(m[2])}" target="_blank" rel="noreferrer">${toHtml(m[1])}</a>`
    return esc(p)
  }).join('').replace(/\n/g, '<br>')
}

type Run = { t: string; b?: boolean; i?: boolean; u?: boolean; c?: string; s?: number; href?: string }
const hex = (rgb: string) => { const m = rgb.match(/\d+(\.\d+)?/g); return m ? '#' + m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('') : rgb }

/** Edited DOM -> markup. Styles are read relative to the element's own base style, so only real differences are stored. */
export function toMarkup(el: HTMLElement): string {
  const base = getComputedStyle(el), bold = (w: string) => +w >= 600, runs: Run[] = []
  const nl = () => { if (runs.length && runs[runs.length - 1].t !== '\n') runs.push({ t: '\n' }) }
  const text = (t: string, p: HTMLElement) => {
    if (!t) return
    const cs = getComputedStyle(p), r: Run = { t: t.replace(/\u00a0/g, ' ') }
    const link = p.closest('a[href]')
    if (link instanceof HTMLAnchorElement) r.href = link.getAttribute('href') || undefined
    if (bold(cs.fontWeight) !== bold(base.fontWeight)) r.b = bold(cs.fontWeight)
    if ((cs.fontStyle === 'italic') !== (base.fontStyle === 'italic')) r.i = cs.fontStyle === 'italic'
    if (cs.textDecorationLine.includes('underline') !== base.textDecorationLine.includes('underline')) r.u = cs.textDecorationLine.includes('underline')
    if (cs.color !== base.color) r.c = hex(cs.color)
    if (cs.fontSize !== base.fontSize) r.s = Math.round(parseFloat(cs.fontSize) * 10) / 10
    runs.push(r)
  }
  const walk = (n: Node) => {
    if (n.nodeType === 3) return text(n.nodeValue || '', n.parentElement || el)
    if (n.nodeName === 'BR') return void runs.push({ t: '\n' })
    const block = n !== el && /^(DIV|P)$/.test(n.nodeName)
    if (block && runs.length) nl()
    n.childNodes.forEach(walk)
  }
  el.childNodes.forEach(walk)
  const same = (a: Run, b: Run) => a.b === b.b && a.i === b.i && a.u === b.u && a.c === b.c && a.s === b.s && a.href === b.href
  const merged: Run[] = []
  for (const r of runs.flatMap((x) => (x.t.includes('\n') ? x.t.split(/(\n)/).filter(Boolean).map((t) => (t === '\n' ? { t } : { ...x, t })) : [x]))) {
    const last = merged[merged.length - 1]
    if (last && last.t !== '\n' && r.t !== '\n' && same(last, r)) last.t += r.t; else merged.push({ ...r })
  }
  return merged.map((r) => {
    const fl = [r.b !== undefined && (r.b ? 'b' : 'b=0'), r.i !== undefined && (r.i ? 'i' : 'i=0'), r.u !== undefined && (r.u ? 'u' : 'u=0'), r.c && `c=${r.c}`, r.s && `s=${r.s}`].filter(Boolean) as string[]
    if (r.t === '\n' || !r.t.trim()) return r.t
    let out = fl.length ? (fl.join(' ') === 'b' ? `**${r.t}**` : `{{${fl.join(' ')}|${r.t}}}`) : r.t
    if (r.href) out = `[${out}](${r.href})`
    return out
  }).join('').replace(/\n+$/, '')
}

const COLORS = ['#111827', '#ffffff', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#6b7280']
const barBtn: CSSProperties = { height: 28, minWidth: 28, border: 0, borderRadius: 6, background: 'transparent', color: '#fff', font: '600 13px system-ui', cursor: 'pointer', padding: '0 6px' }

/** Small floating toolbar above a text being edited: styles the SELECTED words only. */
export function InlineBar({ target }: { target: HTMLElement | null }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null), [open, setOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false), [url, setUrl] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<Range | null>(null)
  useEffect(() => {
    const upd = () => {
      const s = getSelection(), el = target
      if (linkOpen) return
      if (!s || !el || !s.rangeCount || s.isCollapsed || !el.contains(s.anchorNode) || !el.contains(s.focusNode)) { setPos(null); setOpen(false); return }
      const r = s.getRangeAt(0).getBoundingClientRect()
      rangeRef.current = s.getRangeAt(0).cloneRange()
      setPos({ x: Math.max(8, Math.min(window.innerWidth - 330, r.left + r.width / 2 - 160)), y: Math.max(8, r.top - 44) })
    }
    document.addEventListener('selectionchange', upd); return () => document.removeEventListener('selectionchange', upd)
  }, [target, linkOpen])
  useLayoutEffect(() => { document.execCommand('styleWithCSS', false, 'true') }, [])
  if (!pos) return null
  const run = (cmd: string, v?: string) => (e: React.MouseEvent) => { e.preventDefault(); document.execCommand(cmd, false, v) }
  const size = (delta: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    const s = getSelection(); if (!s?.rangeCount || !target) return
    const node = s.anchorNode?.nodeType === 3 ? s.anchorNode.parentElement! : (s.anchorNode as HTMLElement)
    const cur = parseFloat(getComputedStyle(node).fontSize) || 12, next = Math.max(6, Math.min(64, Math.round((cur + delta) * 2) / 2))
    document.execCommand('fontSize', false, '7')
    target.querySelectorAll<HTMLElement>('font[size="7"]').forEach((f) => { const sp = document.createElement('span'); sp.style.fontSize = next + 'px'; sp.innerHTML = f.innerHTML; f.replaceWith(sp) })
    target.querySelectorAll<HTMLElement>('span[style*="xxx-large"]').forEach((sp) => { sp.style.fontSize = next + 'px' })
  }
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const addLink = (e: React.MouseEvent) => {
    e.preventDefault(); if (!target) return
    let href = url.trim()
    if (!/^[a-z][a-z\d+.-]*:/i.test(href)) href = `https://${href}`
    if (!/^https?:\/\//i.test(href)) return
    target.focus()
    const s = getSelection()
    if (rangeRef.current && target?.contains(rangeRef.current.commonAncestorContainer)) {
      s?.removeAllRanges(); s?.addRange(rangeRef.current)
    }
    document.execCommand('createLink', false, href)
    rangeRef.current = null; setLinkOpen(false); setUrl('')
  }
  return createPortal(
    <div ref={ref} data-inline-toolbar="1" onPointerDown={stop} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }} onClick={stop}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 99999, background: '#2c2c2c', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.35)', padding: 4, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', maxWidth: 330 }}>
      <button style={{ ...barBtn, fontWeight: 800 }} title="Bold (Ctrl+B)" onMouseDown={run('bold')}>B</button>
      <button style={{ ...barBtn, fontStyle: 'italic' }} title="Italic (Ctrl+I)" onMouseDown={run('italic')}>I</button>
      <button style={{ ...barBtn, textDecoration: 'underline' }} title="Underline (Ctrl+U)" onMouseDown={run('underline')}>U</button>
      <button style={barBtn} title="Add link" onMouseDown={(e) => { e.preventDefault(); setLinkOpen(!linkOpen); setOpen(false) }}>🔗</button>
      <span style={{ width: 1, height: 18, background: '#555', margin: '0 3px' }} />
      <button style={barBtn} title="Smaller" onMouseDown={size(-1)}>A−</button>
      <button style={barBtn} title="Larger" onMouseDown={size(1)}>A+</button>
      <span style={{ width: 1, height: 18, background: '#555', margin: '0 3px' }} />
      <button style={{ ...barBtn, display: 'flex', alignItems: 'center', gap: 4 }} title="Text colour" onMouseDown={(e) => { e.preventDefault(); setOpen(!open) }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: 'conic-gradient(#dc2626,#ca8a04,#16a34a,#2563eb,#7c3aed,#dc2626)', display: 'inline-block' }} />▾</button>
      <button style={barBtn} title="Clear formatting of the selection" onMouseDown={run('removeFormat')}>Tx</button>
      {open && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 6, width: '100%', borderTop: '1px solid #444', marginTop: 3 }}>
        {COLORS.map((c) => <button key={c} title={c} onMouseDown={run('foreColor', c)} style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid #666', background: c, cursor: 'pointer', padding: 0 }} />)}
      </div>}
      {linkOpen && <form onSubmit={addLink} style={{ display: 'flex', gap: 5, padding: 6, width: '100%', borderTop: '1px solid #444', marginTop: 3 }}>
        <input autoFocus className="inline-url" type="text" inputMode="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} onMouseDown={(e) => e.stopPropagation()} style={{ minWidth: 0, flex: 1, borderRadius: 5, padding: '3px 6px', font: '12px system-ui' }} />
        <button type="submit" style={{ ...barBtn, background: '#0d99ff' }}>Apply</button>
      </form>}
    </div>, document.body)
}
