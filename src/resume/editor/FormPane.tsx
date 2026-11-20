// The content form ("normal mode"). It edits the same document the canvas edits.
import { useState } from 'react'
import { newBlock, type BlockType, BLOCK_LABELS, type Block, type Data, type Obj } from '../core/data'
import { ask } from '../core/confirm'
import { FONTS } from '../core/fonts'
import * as ops from '../core/ops'
import { TEMPLATES } from '../render'
import { CONTACT_ICONS } from '../core/contactIcons'
import { shrinkImage } from './image'
import { chip, F, inp, mini, pri, Rg, sec } from '../ui/kit'

const PD_PRESETS = ['Gender', 'Age', 'Date of birth', 'Nationality', 'Marital status', 'Place of birth', 'Height', 'Political status']
const ICON_CHOICES: [string, string][] = Object.entries(CONTACT_ICONS).map(([k, v]) => [k, v[3]])

const PRESETS: [string, BlockType[]][] = [['Projects', ['entries']], ['Certifications', ['bullets']], ['Publications', ['entries']], ['Awards & Honors', ['entries']], ['Volunteering', ['entries']], ['Research', ['text', 'entries']], ['Teaching', ['entries']], ['Interests', ['tags']], ['References', ['text']], ['Languages', ['skills']], ['Open Source', ['text', 'bullets', 'tags']]]
const mv = (a: unknown[], i: number, k: number) => { if (i + k < 0 || i + k >= a.length) return; const [x] = a.splice(i, 1); a.splice(i + k, 0, x) }
function BlockEd({ b, ub }: { b: Block; ub: (f: (b: Block) => void) => void }) {
  return (
    <>
      {b.type === 'text' && <F l="Text" area v={b.text} on={(v) => ub((x) => { x.text = v })} />}
      {b.type === 'bullets' && <F l="Bullets (one per line)" area v={(b.bullets || []).join('\n')} on={(v) => ub((x) => { x.bullets = v.split('\n') })} />}
      {b.type === 'tags' && <F l="Tags (comma separated)" area v={b.tags} on={(v) => ub((x) => { x.tags = v })} />}
      {b.type === 'skills' && <>
        {(b.skills || []).map((k, i) => (
          <div key={i} className="flex items-end gap-1"><F l="Label" v={k.label} on={(v) => ub((x) => { x.skills![i].label = v })} /><F l="Items" v={k.items} on={(v) => ub((x) => { x.skills![i].items = v })} />
            <button className={mini} onClick={() => ub((x) => mv(x.skills!, i, -1))}>↑</button><button className={mini} onClick={() => ub((x) => mv(x.skills!, i, 1))}>↓</button><button className={mini} onClick={() => ub((x) => { x.skills!.splice(i, 1) })}>✕</button></div>
        ))}
        <button className={mini} onClick={() => ub((x) => { (x.skills ||= []).push({ label: '', items: '' }) })}>+ Add row</button>
      </>}
      {b.type === 'entries' && <>
        {(b.entries || []).map((e, i) => (
          <div key={i} className="space-y-2 rounded border border-slate-200 bg-white p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <F l="Title" v={e.title} on={(v) => ub((x) => { x.entries![i].title = v })} />
              <F l="Date / right text" v={e.right} on={(v) => ub((x) => { x.entries![i].right = v })} />
              <F l="Subtitle (org, degree…)" v={e.sub} on={(v) => ub((x) => { x.entries![i].sub = v })} />
              <F l="Sub right (location…)" v={e.subRight} on={(v) => ub((x) => { x.entries![i].subRight = v })} />
            </div>
            <F l="Bullets (one per line)" area v={(e.bullets || []).join('\n')} on={(v) => ub((x) => { x.entries![i].bullets = v.split('\n') })} />
            <div className="flex gap-1"><button className={mini} onClick={() => ub((x) => mv(x.entries!, i, -1))}>↑</button><button className={mini} onClick={() => ub((x) => mv(x.entries!, i, 1))}>↓</button><button className={mini + ' !text-red-600'} onClick={() => ub((x) => { x.entries!.splice(i, 1) })}>Remove entry</button></div>
          </div>
        ))}
        <button className={mini} onClick={() => ub((x) => { (x.entries ||= []).push({ title: '', right: '', sub: '', subRight: '', bullets: [] }) })}>+ Add entry</button>
      </>}
    </>
  )
}

type Props = { d: Data; tpl: string; up: (f: (d: Data) => void) => void; edit: (f: (d: Data) => Data) => void }

/** Objects added in design mode and template elements hidden there, so the form always reflects the canvas. */
function CanvasCard({ d, edit }: { d: Data; edit: Props['edit'] }) {
  const objs = d.layout?.pages.flatMap((p, pi) => p.objects.map((o) => ({ pi, o }))) || []
  const hidden = Object.entries(d.fmt || {}).filter(([, f]) => f.hidden).map(([id]) => id)
  if (!objs.length && !hidden.length) return null
  const name = (o: Obj) => ({ text: 'Text box', line: 'Divider', rect: 'Box', image: 'Image', icon: 'Icon' }[o.type])
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div><h3 className="font-semibold">Canvas elements</h3><p className="text-xs text-slate-500">Things you added or hid in design mode.</p></div>
      {objs.map(({ pi, o }) => (
        <div key={o.id} className="flex items-end gap-1">
          {o.type === 'text' ? <F l={`Text box · page ${pi + 1}`} v={o.text} on={(v) => edit((x) => ops.patchObjs(x, { [o.id]: { text: v } }))} /> : <span className="flex-1 text-sm text-slate-700">{name(o)} · page {pi + 1}</span>}
          <button className={mini} onClick={() => edit((x) => ops.hideMany(x, [o.id], !o.hidden))}>{o.hidden ? 'Show' : 'Hide'}</button>
          <button className={mini + ' !text-red-600'} onClick={() => edit((x) => ops.removeIds(x, [o.id]))}>✕</button>
        </div>
      ))}
      {hidden.map((id) => <div key={id} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate text-slate-600">Hidden: <code className="text-xs">{id}</code></span><button className={mini} onClick={() => edit((x) => ops.hideMany(x, [id], false))}>Show</button></div>)}
    </div>
  )
}

export function FormPane({ d, tpl, up, edit }: Props) {
  const st = d.style || {}, tp = TEMPLATES[tpl]
  const [nt, setNt] = useState(''), [nks, setNks] = useState<BlockType[]>(['entries'])
  const sty = (k: string, v: unknown) => up((x) => { x.style = { ...(x.style || {}), [k]: v } })
  const move = (i: number, k: number) => up((x) => { if (i + k < 0 || i + k >= x.sections.length) return; const [s] = x.sections.splice(i, 1); x.sections.splice(i + k, 0, s) })
  const addSec = () => { const n = d.sections.length; up((x) => { x.sections.push({ title: nt || 'New section', hideTitle: false, pageBreak: false, flow: 'keep', blocks: nks.map((k) => newBlock(k)) }) }); setNt(''); setTimeout(() => document.getElementById('sec-' + n)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80) }
  return (
    <>
      <details open className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer font-semibold">Style & layout</summary>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <Rg l="Font size (px)" v={st.size ?? tp.size} min={9} max={16} step={0.5} on={(n) => sty('size', n)} />
                <Rg l="Line spacing" v={st.lineHeight ?? 1.45} min={1.1} max={2} step={0.05} on={(n) => sty('lineHeight', n)} />
                <Rg l="Page margin (mm)" v={st.margin ?? 12} min={6} max={25} step={1} on={(n) => sty('margin', n)} />
                <Rg l="Section spacing" v={st.gap ?? tp.gap} min={2} max={26} step={1} on={(n) => sty('gap', n)} />
                <Rg l="Space below header" v={st.headerGap ?? 0} min={0} max={60} step={1} on={(n) => sty('headerGap', n)} />
                <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!st.icons} onChange={(e) => sty('icons', e.target.checked)} />Show icons next to email, phone, location &amp; links</label>
                {tp.photo && <>
                  <label className="block"><span className="text-xs font-medium text-slate-600">Photo shape</span><select className={inp} value={st.photoShape || ''} onChange={(e) => sty('photoShape', e.target.value || undefined)}><option value="">Template default</option><option value="circle">Circle</option><option value="rounded">Rounded</option><option value="square">Square</option></select></label>
                  <Rg l="Photo size (mm)" v={st.photoSize ?? tp.psize ?? 30} min={20} max={50} step={1} on={(n) => sty('photoSize', n)} />
                </>}
                <label className="block"><span className="text-xs font-medium text-slate-600">Font</span><select className={inp} value={st.font || ''} onChange={(e) => sty('font', e.target.value)}>{Object.entries(FONTS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select></label>
                <label className="block"><span className="text-xs font-medium text-slate-600">Header align</span><select className={inp} value={st.align || ''} onChange={(e) => sty('align', e.target.value || undefined)}><option value="">Template default</option><option value="left">Left</option><option value="center">Center</option></select></label>
                <label className="col-span-2 flex items-center gap-3"><span className="text-xs font-medium text-slate-600">Accent color</span><input type="color" value={st.accent || tp.accent} onChange={(e) => sty('accent', e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white" /><button className={mini} onClick={() => up((x) => { delete x.style })}>Reset style</button></label>
              </div>
            </details>
            <div className="rounded-lg bg-indigo-50 p-2 text-xs text-indigo-900">Formatting hints: <code>**bold text**</code> · <code>[link text](https://url)</code> · one bullet per line. In design mode, double-click a text and select words to style only those words (bold, colour, size). In the print dialog choose "Save as PDF" and turn off "Headers and footers".</div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h3 className="font-semibold">Basics</h3>
              <F l="Full name" v={d.basics.name} on={(v) => up((x) => { x.basics.name = v })} />
              <F l="Headline" v={d.basics.headline} on={(v) => up((x) => { x.basics.headline = v })} />
              <div className="grid grid-cols-2 gap-2">
                <F l="Location" v={d.basics.location} on={(v) => up((x) => { x.basics.location = v })} />
                <F l="Phone" v={d.basics.phone} on={(v) => up((x) => { x.basics.phone = v })} />
              </div>
              <F l="Email" v={d.basics.email} on={(v) => up((x) => { x.basics.email = v })} />
              {(d.basics.links || []).map((l, i) => (
                <div key={i} className="flex items-end gap-1"><F l="Link text" v={l.label} on={(v) => up((x) => { x.basics.links![i].label = v })} /><F l="URL" v={l.url} on={(v) => up((x) => { x.basics.links![i].url = v })} /><button className={mini} onClick={() => up((x) => { x.basics.links!.splice(i, 1) })}>✕</button></div>
              ))}
              <button className={mini} onClick={() => up((x) => { (x.basics.links ||= []).push({ label: '', url: '' }) })}>+ Add link</button>
              {st.icons && (
                <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-xs font-medium text-slate-600">Contact icons (auto-chosen, change or remove)</summary>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {([['location', 'Location', d.basics.location], ['phone', 'Phone', d.basics.phone], ['email', 'Email', d.basics.email], ...(d.basics.links || []).map((l, i) => [`link${i}`, l.label || `Link ${i + 1}`, l.label || l.url])] as [string, string, string | undefined][]).filter(([, , v]) => v).map(([id, name]) => (
                      <label key={id} className="flex items-center gap-2 text-xs text-slate-600"><span className="w-20 shrink-0 truncate">{name}</span>
                        <select className={inp + ' !py-1 !text-xs'} value={d.basics.icons?.[id] || ''} onChange={(e) => up((x) => { x.basics.icons = { ...(x.basics.icons || {}) }; if (e.target.value) x.basics.icons[id] = e.target.value; else delete x.basics.icons[id] })}>
                          <option value="">Auto</option><option value="none">No icon</option>{ICON_CHOICES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                        </select></label>
                    ))}
                  </div>
                </details>
              )}
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div><h3 className="font-semibold">Photo &amp; personal details</h3><p className="text-xs text-slate-500">Shown by the templates marked “(photo)”: {Object.values(TEMPLATES).filter((x) => x.photo).map((x) => x.name.replace(/ \(photo\)/, '')).join(' · ')}.</p></div>
              <div className="flex items-center gap-3">
                {d.basics.photo ? <img src={d.basics.photo} alt="" className="h-16 w-14 rounded-md border border-slate-200 object-cover" /> : <div className="grid h-16 w-14 place-items-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">No photo</div>}
                <label className={sec + ' !px-3 !py-1.5 !text-xs cursor-pointer'}>{d.basics.photo ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const r = await shrinkImage(f); up((x) => { x.basics.photo = r.src }) } }} /></label>
                {d.basics.photo && <button className={mini + ' !text-red-600'} onClick={() => up((x) => { delete x.basics.photo })}>Remove</button>}
              </div>
              {(d.basics.personal || []).map((p, i) => (
                <div key={i} className="flex items-end gap-1"><F l="Label" v={p.label} on={(v) => up((x) => { x.basics.personal![i].label = v })} /><F l="Value" v={p.value} on={(v) => up((x) => { x.basics.personal![i].value = v })} />
                  <button className={mini} onClick={() => up((x) => { x.basics.personal!.splice(i, 1) })}>✕</button></div>
              ))}
              <div className="flex flex-wrap gap-1.5">{PD_PRESETS.filter((l) => !(d.basics.personal || []).some((p) => p.label === l)).map((l) => <button key={l} className={chip(false)} onClick={() => up((x) => { (x.basics.personal ||= []).push({ label: l, value: '' }) })}>+ {l}</button>)}
                <button className={chip(false)} onClick={() => up((x) => { (x.basics.personal ||= []).push({ label: '', value: '' }) })}>+ Custom</button></div>
            </div>
            {d.sections.map((s, si) => (
              <div key={si} id={'sec-' + si} className="anim-in space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-end gap-1">
                  <F l="Section title" v={s.title} on={(v) => up((x) => { x.sections[si].title = v })} />
                  <button className={mini} onClick={() => move(si, -1)}>↑</button><button className={mini} onClick={() => move(si, 1)}>↓</button>
                  <button className={mini + ' !text-red-600'} onClick={async () => { if (await ask(`Delete the section "${s.title || 'Untitled'}" and everything in it?`)) up((x) => { x.sections.splice(si, 1) }) }}>✕</button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={!s.hideTitle} onChange={(e) => up((x) => { x.sections[si].hideTitle = !e.target.checked })} />Show title</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!s.pageBreak} onChange={(e) => up((x) => { x.sections[si].pageBreak = e.target.checked })} />Start on a new page</label>
                  <label className="flex items-center gap-1.5">Space above: <input type="range" min={0} max={80} step={1} value={s.gapTop ?? st.gap ?? tp.gap} onChange={(e) => up((x) => { x.sections[si].gapTop = Number(e.target.value) })} className="w-24" /><span className="w-6 text-right tabular-nums">{s.gapTop ?? st.gap ?? tp.gap}</span>
                    {s.gapTop !== undefined && <button className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px]" onClick={() => up((x) => { delete x.sections[si].gapTop })}>Auto</button>}</label>
                  <label className="flex items-center gap-1.5">If it doesn't fit:<select className="rounded border border-slate-300 bg-white px-1 py-0.5 text-slate-800" value={s.flow || 'keep'} onChange={(e) => up((x) => { x.sections[si].flow = e.target.value as 'keep' | 'split' })}><option value="keep">move whole section to next page</option><option value="split">split across pages</option></select></label>
                </div>
                {s.blocks.map((b, bi) => (
                  <div key={bi} className="anim-in space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{BLOCK_LABELS[b.type].split(' (')[0]}</span>
                      <span className="ml-auto flex gap-1"><button className={mini} onClick={() => up((x) => mv(x.sections[si].blocks, bi, -1))}>↑</button><button className={mini} onClick={() => up((x) => mv(x.sections[si].blocks, bi, 1))}>↓</button>
                        <button className={mini + ' !text-red-600'} onClick={async () => { if (await ask('Remove this block?', 'Remove')) up((x) => { x.sections[si].blocks.splice(bi, 1) }) }}>✕</button></span>
                    </div>
                    <BlockEd b={b} ub={(f) => up((x) => f(x.sections[si].blocks[bi]))} />
                  </div>
                ))}
                <select className={inp} value="" onChange={(e) => { const t = e.target.value as BlockType; if (t) up((x) => { x.sections[si].blocks.push(newBlock(t)) }) }}>
                  <option value="">+ Add a block to this section…</option>{Object.entries(BLOCK_LABELS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </div>
            ))}
            <div className="space-y-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-3">
              <h3 className="font-semibold">Add a section</h3>
              <div><span className="text-xs font-medium text-slate-600">1. Pick a preset (optional)</span>
                <div className="mt-1 flex flex-wrap gap-1.5">{PRESETS.map(([n, k]) => <button key={n} className={chip(nt === n)} onClick={() => { setNt(n); setNks(k) }}>{n}</button>)}</div></div>
              <F l="2. Section name" v={nt} on={setNt} />
              <div><span className="text-xs font-medium text-slate-600">3. Blocks to start with (tap to select several)</span>
                <div className="mt-1 flex flex-wrap gap-1.5">{(Object.keys(BLOCK_LABELS) as BlockType[]).map((k) => <button key={k} className={chip(nks.includes(k))} onClick={() => setNks((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>{nks.includes(k) ? '✓ ' : ''}{BLOCK_LABELS[k].split(' (')[0]}</button>)}</div></div>
              <p className="text-xs text-slate-500">You can add, remove and reorder blocks inside the section afterwards.</p>
              <button className={pri + ' w-full'} onClick={addSec}>+ Add section{nks.length ? ` with ${nks.length} block${nks.length > 1 ? 's' : ''}` : ' (empty)'}</button>
            </div>
      <CanvasCard d={d} edit={edit} />
    </>
  )
}
