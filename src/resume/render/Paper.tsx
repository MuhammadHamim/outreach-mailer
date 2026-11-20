// Renders the resume as real A4 pages: content flows automatically, free objects sit on top.
import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Data, Entry, Section } from '../core/data'
import { OverlayLayer } from '../canvas/Overlay'
import { pagePointerDown } from '../canvas/interactions'
import { BASE, Cx, EditCtx, type Ctx } from './context'
import { Li, Rule, T, Tags } from './elements'
import { CONTACT_ICONS, autoIcon } from '../core/contactIcons'
import { resolve, type Base, type Resolved } from './templates'

type Unit = { id: string; s: number; node: ReactNode }
const MM = 96 / 25.4

function entry(e: Entry, t: Resolved, ink: string, mu: string, a: string, pre: string) {
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12 }
  return (
    <div style={{ paddingBottom: 9 }}>
      <div style={row}><h3 style={{ margin: 0, fontSize: t.size + 1, fontWeight: 700, color: ink }}><T id={pre + 'title'} text={e.title} a={a} /></h3>{e.right && <span style={{ color: mu, whiteSpace: 'nowrap' }}><T id={pre + 'right'} text={e.right} a={a} /></span>}</div>
      {(e.sub || e.subRight) && <div style={{ ...row, fontStyle: 'italic', color: mu }}><span><T id={pre + 'sub'} text={e.sub || ''} a={a} /></span><span><T id={pre + 'subRight'} text={e.subRight || ''} a={a} /></span></div>}
      {!!e.bullets?.filter(Boolean).length && <ul style={{ margin: '4px 0 0', paddingLeft: 18, listStyleType: 'disc' }}>{e.bullets.map((b, j) => b ? <Li key={j} id={`${pre}bl${j}`} text={b} a={a} mb={2} /> : null)}</ul>}
    </div>
  )
}

const isSide = (s: Section) => !!s.blocks?.length && s.blocks.every((b) => b.type === 'skills')

/** A section as a list of "units" (heading + one unit per entry/row), so pagination can place them page by page. */
function parts(s: Section, si: number, t: Resolved, dark: boolean): Unit[] {
  const mu = dark ? '#cbd5e1' : '#4b5563', a = dark ? '#93c5fd' : t.accent, ink = dark ? '#fff' : t.ink
  const heads: Record<Base['head'], CSSProperties> = {
    rule: { fontSize: t.size + 2, letterSpacing: 1, textTransform: 'uppercase', color: t.accent },
    bar: { fontSize: t.size + 1.5, textTransform: 'uppercase', color: t.accent, borderLeft: `4px solid ${t.accent}`, paddingLeft: 8 },
    caps: { fontSize: t.size, textTransform: 'uppercase', letterSpacing: 0.8, color: t.ink },
    small: { fontSize: t.size + 2, fontVariant: 'small-caps', letterSpacing: 0.5, color: '#000' },
  }
  const hasRule = t.head !== 'bar', rc = dark ? 'rgba(255,255,255,.5)' : t.head === 'rule' ? t.accent : t.head === 'caps' ? '#9ca3af' : '#000', rth = t.head === 'rule' || dark ? 1.5 : 1
  const h: CSSProperties = { margin: 0, fontWeight: 700, paddingBottom: hasRule ? (t.head === 'rule' ? 3 : 2) : 0, ...heads[t.head], ...(dark ? { color: '#fff' } : {}) }
  const u = (id: string, node: ReactNode): Unit => ({ id: `${id}${si}`, s: si, node })
  const gt = s.gapTop ?? t.gap
  const out: Unit[] = [u('h', s.hideTitle ? <div style={{ height: gt }} /> : <div style={{ paddingTop: gt }}><h2 style={h}><T id={`s${si}.title`} text={s.title} a={a} /></h2>{hasRule && <Rule id={`s${si}.rule`} color={rc} th={rth} />}<div style={{ height: 6 }} /></div>)]
  ;(s.blocks || []).forEach((bk, bi) => {
    const p = `b${bi}.`, pre = `s${si}.b${bi}.`
    if (bk.type === 'text') out.push(u(p, <p style={{ margin: '0 0 6px', lineHeight: 1.55, whiteSpace: 'pre-line' }}><T id={pre + 'text'} text={bk.text || ''} a={a} /></p>))
    if (bk.type === 'skills') (bk.skills || []).forEach((k, i) => out.push(u(`${p}${i}.`, <p style={{ margin: '0 0 4px' }}><strong style={{ color: ink }}><T id={`${pre}k${i}.label`} text={k.label} a={a} />{k.items ? ': ' : ''}</strong><T id={`${pre}k${i}.items`} text={k.items} a={a} /></p>)))
    if (bk.type === 'entries') (bk.entries || []).forEach((e, i) => out.push(u(`${p}${i}.`, entry(e, t, ink, mu, a, `${pre}e${i}.`))))
    if (bk.type === 'bullets') (bk.bullets || []).forEach((x, j) => { if (x) out.push(u(`${p}${j}.`, <ul style={{ margin: '0 0 3px', paddingLeft: 18, listStyleType: 'disc' }}><Li id={`${pre}bl${j}`} text={x} a={a} /></ul>)) })
    if (bk.type === 'tags' && bk.tags?.trim()) out.push(u(p, <Tags id={pre + 'tags'} tags={bk.tags} size={t.size} dark={dark} />))
  })
  return out
}

function Ic({ k, size, color }: { k: string; size: number; color: string }) {
  const i = CONTACT_ICONS[k]; if (!i) return null
  return <svg aria-hidden viewBox={`0 0 ${i[0]} ${i[1]}`} width={(size * i[0]) / i[1]} height={size} fill="currentColor" style={{ display: 'inline-block', color, marginRight: 5, verticalAlign: '-0.13em', flex: 'none' }}><path d={i[2]} /></svg>
}
function Photo({ src, mm, shape, ratio = 1 }: { src?: string; mm: number; shape: string; ratio?: number }) {
  if (!src) return null
  const w = mm * MM
  return <img src={src} alt="" style={{ width: w, height: w * ratio, objectFit: 'cover', display: 'block', flex: 'none', borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? 10 : 0 }} />
}

export function Paper({ d, tpl, first }: { d: Data; tpl: string; first?: boolean }) {
  const t = resolve(d, tpl), b = d.basics, side = !!t.side
  const outer = useContext(EditCtx)
  const val: Ctx = { ...BASE, ...(outer || {}), fmt: d.fmt || {} }
  const band = t.photo === 'band', grid = t.photo === 'grid'
  const a0 = side || band ? (band ? '#ffffff' : '#93c5fd') : t.accent
  // contact details, each with an optional icon that is part of the same element (they always move together)
  const lead = (id: string, kind: 'location' | 'email' | 'phone' | 'link', url = '', label = '') => {
    if (!t.icons) return undefined
    const pick = b.icons?.[id]
    if (pick === 'none') return undefined
    return <Ic k={pick && CONTACT_ICONS[pick] ? pick : autoIcon(kind, url, label)} size={Math.max(8, t.size - 1.5)} color={a0} />
  }
  const contact: ReactNode[] = [
    b.location && <T id="basics.location" text={b.location} a={a0} lead={lead('location', 'location')} />, b.email && <T id="basics.email" text={b.email} a={a0} lead={lead('email', 'email')} />, b.phone && <T id="basics.phone" text={b.phone} a={a0} lead={lead('phone', 'phone')} />,
    ...(b.links || []).map((l, i) => <T key={`link${i}`} id={`basics.link${i}`} text={l.label} a={a0} href={l.url} lead={lead(`link${i}`, 'link', l.url || '', l.label)} />),
  ].filter(Boolean)
  const pd = (b.personal || []).map((p, i) => ({ p, i })).filter(({ p }) => p.label || p.value)
  const pdLead = (p: { label: string; value: string }) => p.label ? <span style={{ opacity: 0.75 }}>{p.label}{p.value ? ': ' : ''}</span> : undefined
  const pdItem = ({ p, i }: { p: { label: string; value: string }; i: number }) => <T id={`basics.pd${i}.value`} text={p.value} a={a0} lead={pdLead(p)} />
  const pdInline = (col: string) => pd.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', margin: '0 0 6px', color: col }}>{pd.map((item) => <span key={item.i}>{pdItem(item)}</span>)}</div> : null
  const root: CSSProperties = { fontFamily: t.font, fontSize: t.size, color: '#1f2937', lineHeight: t.lh }
  const units: Unit[] = []
  let aside: ReactNode = null
  const hgap = t.headerGap ? <div style={{ height: t.headerGap }} /> : null
  if (side) {
    aside = (
      <>
        {t.photo === 'side' && b.photo && <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 12px' }}><Photo src={b.photo} mm={t.psize ?? 38} shape={t.shape || 'circle'} /></div>}
        <h1 style={{ margin: '0 0 4px', fontSize: t.size * 2, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}><T id="basics.name" text={b.name} a={a0} /></h1>
        <p style={{ margin: 0, color: '#cbd5e1' }}><T id="basics.headline" text={b.headline || ''} a={a0} /></p>
        {t.photo === 'side' && pd.length > 0 && <div style={{ margin: '12px 0 0', display: 'grid', gap: 2, fontSize: t.size - 1, color: '#e2e8f0' }}>{pd.map((item) => <div key={item.i}>{pdItem(item)}</div>)}</div>}
        <div style={{ margin: '12px 0', display: 'grid', gap: 4, fontSize: t.size - 1, wordBreak: 'break-word' }}>{contact.map((x, i) => <div key={i}>{x}</div>)}</div>
        {d.sections.map((s, si) => isSide(s) && parts(s, si, t, true).map((u) => <div key={u.id}>{u.node}</div>))}
      </>
    )
  } else if (band) {
    units.push({ id: 'hdr', s: -1, node: (
      <div>
        <div style={{ margin: `-${t.margin}mm -${t.margin}mm 10px`, padding: `${t.margin}mm`, background: t.accent, color: '#fff', display: 'flex', alignItems: 'center', gap: 18 }}>
          <Photo src={b.photo} mm={t.psize ?? 30} shape={t.shape || 'circle'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: '0 0 3px', fontSize: t.size * 2.5, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}><T id="basics.name" text={b.name} a={a0} /></h1>
            {b.headline && <p style={{ margin: '0 0 8px', fontSize: t.size + 2, color: 'rgba(255,255,255,.85)' }}><T id="basics.headline" text={b.headline} a={a0} /></p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px', color: '#fff' }}>{contact.map((x, i) => <span key={i}>{x}</span>)}</div>
          </div>
        </div>
        {pdInline('#4b5563')}{hgap}
      </div>
    ) })
  } else if (grid) {
    units.push({ id: 'hdr', s: -1, node: (
      <div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', paddingBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: '0 0 2px', fontSize: t.size * 2.4, fontWeight: 700, color: t.ink, lineHeight: 1.15 }}><T id="basics.name" text={b.name} a={a0} /></h1>
            {b.headline && <p style={{ margin: '0 0 8px', fontSize: t.size + 2, color: t.accent, fontWeight: 600 }}><T id="basics.headline" text={b.headline} a={a0} /></p>}
            {pd.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '3px 18px', margin: '0 0 8px' }}>{pd.map((item) => <div key={item.i}>{pdItem(item)}</div>)}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px' }}>{contact.map((x, i) => <span key={i}>{x}</span>)}</div>
          </div>
          <Photo src={b.photo} mm={t.psize ?? 28} shape={t.shape || 'square'} ratio={1.35} />
        </div>
        <Rule id="basics.rule" color={t.accent} th={2} />{hgap}
      </div>
    ) })
  } else {
    const photoTop = t.photo === 'top'
    units.push({ id: 'hdr', s: -1, node: (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0, textAlign: t.center ? 'center' : 'left' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: t.size * 2.5, fontWeight: 700, letterSpacing: 1, color: t.ink, lineHeight: 1.15 }}><T id="basics.name" text={b.name} a={a0} /></h1>
            {b.headline && <p style={{ margin: '0 0 8px', fontSize: t.size + 2, color: '#4b5563' }}><T id="basics.headline" text={b.headline} a={a0} /></p>}
            {photoTop && pd.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: t.center ? 'center' : 'flex-start', gap: '2px 16px', margin: '0 0 6px', color: '#4b5563' }}>{pd.map((item) => <span key={item.i}>{pdItem(item)}</span>)}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: t.center ? 'center' : 'flex-start', gap: '4px 16px' }}>{contact.map((x, i) => <span key={i}>{x}</span>)}</div>
          </div>
          {photoTop && <Photo src={b.photo} mm={t.psize ?? 30} shape={t.shape || 'rounded'} />}
        </div>
        <Rule id="basics.rule" color={t.head === 'bar' ? t.accent : t.ink} th={2} />{hgap}
      </div>
    ) })
  }
  d.sections.forEach((s, si) => { if (!(side && isSide(s))) units.push(...parts(s, si, t, false)) })

  // --- pagination: measure every unit once, then fill pages ---
  const m = t.margin, W = (side ? 0.68 * 210 - m - 8 : 210 - 2 * m) * MM, H = (297 - 2 * m) * MM - 3
  const mref = useRef<HTMLDivElement>(null)
  const [hs, setHs] = useState<Record<string, number>>({})
  useLayoutEffect(() => {
    const n: Record<string, number> = {}
    mref.current?.querySelectorAll<HTMLElement>('[data-id]').forEach((e) => { n[e.dataset.id!] = e.offsetHeight })
    setHs((p) => (JSON.stringify(p) === JSON.stringify(n) ? p : n))
  })
  const pages: Unit[][] = [[]]
  let y = 0
  const sum = (g: Unit[]) => g.reduce((acc, u) => acc + (hs[u.id] ?? 0), 0)
  const put = (g: Unit[]) => { const h = sum(g); if (y + h > H && pages[pages.length - 1].length) { pages.push([]); y = 0 } pages[pages.length - 1].push(...g); y += h }
  put(units.filter((u) => u.s < 0))
  d.sections.forEach((s, si) => {
    const g = units.filter((u) => u.s === si)
    if (!g.length) return
    if (s.pageBreak && pages[pages.length - 1].length) { pages.push([]); y = 0 }
    if (s.flow !== 'split' && sum(g) <= H) put(g)
    else { const k = g[0].id.startsWith('h') ? 2 : 1; put(g.slice(0, k)); g.slice(k).forEach((u) => put([u])) }
  })
  while (pages.length < (d.layout?.pages.length || 0)) pages.push([])

  const shown = first ? pages.slice(0, 1) : pages
  const pageStyle: CSSProperties = { ...root, width: '210mm', height: '297mm', boxSizing: 'border-box', background: '#fff', overflow: 'hidden', position: 'relative', display: side ? 'flex' : 'block', padding: side ? 0 : `${m}mm` }
  return (
    <Cx.Provider value={val}>
      <div id="pages" style={{ position: 'relative', userSelect: val.on ? 'none' : undefined }}>
        <Cx.Provider value={{ ...val, on: false }}>
          <div ref={mref} aria-hidden style={{ ...root, position: 'absolute', left: -99999, top: 0, width: W, visibility: 'hidden', pointerEvents: 'none' }}>
            {units.map((u) => <div key={u.id} data-id={u.id} style={{ display: 'flow-root' }}>{u.node}</div>)}
          </div>
        </Cx.Provider>
        {shown.map((p, i) => (
          <div key={i} className="pwrap">
            {!first && <div className="print:hidden pb-1.5 pt-4 text-center text-xs font-medium text-slate-400">Page {i + 1} of {pages.length}</div>}
            <div className="page" data-blank={p.length === 0 ? '1' : undefined} style={{ ...pageStyle, background: d.layout?.pages[i]?.bg || '#fff' }} onPointerDown={val.on ? (e) => pagePointerDown(e, val, i) : undefined}>
              {side && <div style={{ width: '32%', background: t.accent, color: '#e2e8f0', padding: `${m}mm 5mm`, boxSizing: 'border-box' }}>{i === 0 && aside}</div>}
              <div style={side ? { width: '68%', padding: `${m}mm ${m}mm ${m}mm 8mm`, boxSizing: 'border-box' } : undefined}>{p.map((u) => <div key={u.id} style={{ display: 'flow-root' }}>{u.node}</div>)}</div>
              <OverlayLayer pi={i} objs={d.layout?.pages[i]?.objects || []} />
            </div>
          </div>
        ))}
      </div>
    </Cx.Provider>
  )
}
