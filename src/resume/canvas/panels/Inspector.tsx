import { useRef } from 'react'
import type { Data } from '../../core/data'
import { FONTS } from '../../core/fonts'
import type { AlignMode } from '../../core/geometry'
import { isObjId } from '../../core/ops'
import { type IconName } from '../../ui/icons'
import { B, ColorRow, IconBtn, inp, NF, Section, Seg, SelF } from '../../ui/kit'
import { readProps, type Props } from '../adapter'
import type { DesignApi } from '../types'

const ALIGN: { k: AlignMode; n: IconName; t: string }[] = [
  { k: 'left', n: 'alignL', t: 'Align left' }, { k: 'hcenter', n: 'alignC', t: 'Align horizontal centers' }, { k: 'right', n: 'alignR', t: 'Align right' },
  { k: 'top', n: 'alignT', t: 'Align top' }, { k: 'vcenter', n: 'alignM', t: 'Align vertical centers' }, { k: 'bottom', n: 'alignB', t: 'Align bottom' },
]
function AlignRow({ api }: { api: DesignApi }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5">
      {ALIGN.map((a) => <IconBtn key={a.k} n={a.n} title={a.t} onClick={() => api.align(a.k)} />)}
      <span className="mx-0.5 h-4 w-px bg-slate-200" />
      <IconBtn n="distH" title="Distribute horizontally" disabled={api.sel.length < 3} onClick={() => api.distribute('h')} />
      <IconBtn n="distV" title="Distribute vertically" disabled={api.sel.length < 3} onClick={() => api.distribute('v')} />
    </div>
  )
}
const Check = ({ l, v, on }: { l: string; v: boolean; on: (b: boolean) => void }) => <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" className="accent-[#0d99ff]" checked={v} onChange={(e) => on(e.target.checked)} />{l}</label>
const ALIGN_SEG = [{ k: 'left', n: 'tleft' as IconName, t: 'Align left' }, { k: 'center', n: 'tcenter' as IconName, t: 'Align center' }, { k: 'right', n: 'tright' as IconName, t: 'Align right' }]
const TITLE: Record<Props['type'], string> = { text: 'Text', line: 'Line', rect: 'Rectangle', image: 'Image', icon: 'Icon', rule: 'Divider', tags: 'Tags' }

function PageInspector({ d, api }: { d: Data; api: DesignApi }) {
  return (
    <>
      <Section title={`Page ${api.cpage + 1}`}><ColorRow v={d.layout?.pages[api.cpage]?.bg || '#ffffff'} on={api.pageBg} /></Section>
      <Section title="View">
        <Check l="Snap to guides" v={api.snap.on} on={(b) => api.setSnap({ ...api.snap, on: b })} />
        <div className="flex items-center gap-2 text-xs text-slate-700">Grid step<div className="w-24"><SelF v={String(api.snap.grid)} on={(v) => api.setSnap({ ...api.snap, grid: +v })}>{[2, 4, 8, 16].map((g) => <option key={g} value={g}>{g}px</option>)}</SelF></div></div>
        <Check l="Show grid" v={api.view.grid} on={(b) => api.setView({ ...api.view, grid: b })} />
        <Check l="Show margins" v={api.view.margins} on={(b) => api.setView({ ...api.view, margins: b })} />
      </Section>
      <Section title="Edits"><B onClick={api.resetAll}>Reset all element edits</B><p className="text-[11px] leading-4 text-slate-500">Select an element to edit it. Shift-click or drag a box for several. Double-click text to type. Ctrl + wheel zooms; right-drag or Space + drag pans.</p></Section>
    </>
  )
}

function MultiInspector({ api }: { api: DesignApi }) {
  return (
    <>
      <AlignRow api={api} />
      <Section title={`${api.sel.length} selected`} action={<><IconBtn n="copy" title="Duplicate" onClick={api.dup} /><IconBtn n="trash" title="Delete" onClick={api.del} /></>}>
        <div className="flex flex-wrap gap-1"><B onClick={api.group}><span className="inline-flex items-center gap-1">Group</span></B><B onClick={api.ungroup}>Ungroup</B><B onClick={() => api.lock(api.sel, true)}>Lock</B><B onClick={() => api.hide(api.sel, true)}>Hide</B></div>
      </Section>
      <Section title="Style all">
        <SelF v="" on={(v) => v && api.style({ font: v })}><option value="">Font…</option>{Object.entries(FONTS).filter(([k]) => k).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</SelF>
        <ColorRow on={(c) => api.style({ color: c })} />
        <div className="flex gap-1"><IconBtn n="bold" title="Bold" onClick={() => api.style({ bold: true })} /><IconBtn n="italic" title="Italic" onClick={() => api.style({ italic: true })} /><IconBtn n="underline" title="Underline" onClick={() => api.style({ underline: true })} />
          <Seg items={ALIGN_SEG} on={(k) => api.style({ align: k as 'left' | 'center' | 'right' })} /></div>
      </Section>
    </>
  )
}

/** Right panel (Figma's "Design" tab): sections adapt to what is selected. */
export function Inspector({ d, api, z }: { d: Data; api: DesignApi; z: number }) {
  const fi = useRef<HTMLInputElement>(null)
  if (api.sel.length > 1) return <MultiInspector api={api} />
  const p = api.sel.length ? readProps(d, api.sel[0], z) : null
  if (!p) return <PageInspector d={d} api={api} />
  const set = api.setProps, obj = p.kind === 'obj', locked = obj ? false : !!d.fmt?.[p.id]?.locked
  const isText = p.type === 'text', shape = p.type === 'rect'
  return (
    <>
      <AlignRow api={api} />
      <Section title={TITLE[p.type]} action={<>{obj && <IconBtn n="copy" title="Duplicate (Ctrl+D)" onClick={api.dup} />}<IconBtn n={locked ? 'lock' : 'unlock'} title="Lock" onClick={() => api.lock([p.id], true)} /><IconBtn n="trash" title={obj ? 'Delete' : 'Hide'} onClick={api.del} /></>}>
        <div className="grid grid-cols-2 gap-2">
          <NF l="X" v={p.x} on={(n) => set({ x: n })} /><NF l="Y" v={p.y} on={(n) => set({ y: n })} />
          <NF l="W" title={p.type === 'icon' ? 'Size' : 'Width'} v={p.w} min={1} on={(n) => set({ w: n })} />
          {obj && p.h !== undefined && p.type !== 'icon' && <NF l="H" v={p.h} min={1} on={(n) => set({ h: n })} />}
          {obj && p.type !== 'line' && <NF l="∠" title="Rotation (degrees)" v={p.rot} on={(n) => set({ rot: n })} />}
          {(shape || p.type === 'image') && <NF l="◜" title="Corner radius" v={p.radius ?? 0} min={0} on={(n) => set({ radius: n })} />}
        </div>
      </Section>
      {isText && (
        <Section title="Text">
          <textarea rows={2} className={inp + ' !text-[16px] sm:!text-xs'} value={p.text ?? ''} onChange={(e) => set({ text: e.target.value })} aria-label="Text content" />
          <SelF v={p.font} on={(v) => set({ font: v })}>{Object.entries(FONTS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</SelF>
          <div className="grid grid-cols-2 gap-2"><NF l="Aa" title="Font size" v={p.size} min={4} on={(n) => set({ size: n })} />{obj && <NF l="↕" title="Line height" v={p.lh} step={0.05} min={0.8} on={(n) => set({ lh: n })} />}{obj && <NF l="↔" title="Letter spacing" v={p.ls} step={0.25} on={(n) => set({ ls: n })} />}</div>
          <div className="flex items-center gap-1"><IconBtn n="bold" title="Bold" on={p.bold} onClick={() => set({ bold: !p.bold })} /><IconBtn n="italic" title="Italic" on={p.italic} onClick={() => set({ italic: !p.italic })} /><IconBtn n="underline" title="Underline" on={p.underline} onClick={() => set({ underline: !p.underline })} />
            <div className="ml-1 flex-1"><Seg items={ALIGN_SEG} v={p.align} on={(k) => set({ align: k as Props['align'] })} /></div></div>
        </Section>
      )}
      <Section title="Layer"><NF l="◐" title="Opacity (%)" v={Math.round(p.opacity * 100)} min={0} max={100} on={(n) => set({ opacity: n / 100 })} /></Section>
      {isText && <Section title="Fill"><ColorRow v={p.color} on={(c) => set({ color: c })} /></Section>}
      {shape && <Section title="Fill" action={<IconBtn n={p.fill ? 'minus' : 'plus'} title={p.fill ? 'Remove fill' : 'Add fill'} onClick={() => set({ fill: p.fill ? '' : '#d9d9d9' })} />}>{p.fill ? <ColorRow v={p.fill} on={(c) => set({ fill: c })} /> : <p className="text-xs text-slate-500">No fill</p>}</Section>}
      {shape && <Section title="Stroke"><ColorRow v={p.stroke} on={(c) => set({ stroke: c, sw: p.sw || 1 })} /><NF l="W" title="Stroke width" v={p.sw ?? 0} min={0} on={(n) => set({ sw: n })} /></Section>}
      {(p.type === 'line' || p.type === 'rule') && <Section title="Stroke"><ColorRow v={p.color} on={(c) => set({ color: c })} /><NF l="W" title="Thickness" v={p.thickness ?? 2} min={0.5} step={0.5} on={(n) => set({ thickness: n })} />{p.type === 'line' && <Check l="Dashed" v={!!p.dash} on={(b) => set({ dash: b })} />}</Section>}
      {p.type === 'icon' && <Section title="Stroke"><ColorRow v={p.color} on={(c) => set({ color: c })} /><NF l="W" title="Line width" v={p.sw ?? 2} min={0.5} step={0.5} on={(n) => set({ sw: n })} /></Section>}
      {p.type === 'image' && <Section title="Image"><SelF v={p.fit ?? 'cover'} on={(v) => set({ fit: v as 'cover' | 'contain' })}><option value="cover">Fill (crop)</option><option value="contain">Fit inside</option></SelF><B onClick={() => fi.current?.click()}>Replace image</B><input ref={fi} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) api.replaceImg(f); e.target.value = '' }} /></Section>}
      {!obj && <Section title="Template element"><p className="text-[11px] leading-4 text-slate-500">{d.fmt?.[p.id]?.ax === undefined ? 'Move it on the canvas to place it freely. Other elements stay where they are.' : 'Placed freely; it no longer affects other elements.'}</p><B onClick={() => api.clearFmt(p.id)}>Reset element</B></Section>}
      {isObjId(p.id) && null}
    </>
  )
}
