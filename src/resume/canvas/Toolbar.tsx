import { useRef, useState } from 'react'
import type { Tool } from '../render'
import { Icon, type IconName } from '../ui/icons'
import { ICONS } from './icons'

const TOOLS: { t: Tool; n: IconName; label: string }[] = [
  { t: 'move', n: 'move', label: 'Move (V)' }, { t: 'hand', n: 'hand', label: 'Hand (H)' }, { t: 'rect', n: 'rect', label: 'Rectangle (R)' },
  { t: 'ellipse', n: 'ellipse', label: 'Ellipse (O)' }, { t: 'line', n: 'line', label: 'Line (L)' }, { t: 'text', n: 'text', label: 'Text (T)' },
]
const btn = (on: boolean) => 'grid h-9 w-9 place-items-center rounded-lg transition ' + (on ? 'bg-[#0d99ff] text-white' : 'text-[#ffffffd9] hover:bg-[#ffffff1a]')

/** Figma-style floating tool bar (bottom centre). */
export function Toolbar({ tool, setTool, addImg, addIcon, addSkill }: { tool: Tool; setTool: (t: Tool) => void; addImg: (f: File, circle?: boolean) => void; addIcon: (n: string) => void; addSkill: () => void }) {
  const img = useRef<HTMLInputElement>(null), photo = useRef<HTMLInputElement>(null), [open, setOpen] = useState(false)
  return (
    <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 lg:bottom-4 print:hidden">
      {open && (
        <div className="anim-pop absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl bg-[#2c2c2c] p-2 text-white shadow-xl">
          <div className="mb-1 px-1 text-[11px] font-semibold text-[#ffffff99]">Resume elements</div>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#ffffff1a]" onClick={() => { photo.current?.click(); setOpen(false) }}><Icon n="user" /> Profile photo</button>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#ffffff1a]" onClick={() => { addSkill(); setOpen(false) }}><Icon n="bar" /> Skill bar</button>
          <div className="mb-1 mt-2 px-1 text-[11px] font-semibold text-[#ffffff99]">Icons</div>
          <div className="grid grid-cols-5 gap-1">{Object.entries(ICONS).map(([name, d]) => (
            <button key={name} title={name} className="grid h-9 place-items-center rounded-md hover:bg-[#ffffff1a]" onClick={() => { addIcon(name); setOpen(false) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
            </button>))}</div>
        </div>
      )}
      <div className="flex items-center gap-0.5 rounded-xl bg-[#2c2c2c] p-1 shadow-xl">
        {TOOLS.map((x, i) => (<span key={x.t} className="flex items-center">{(i === 2 || i === 5) && <span className="mx-1 h-5 w-px bg-[#ffffff26]" />}<button title={x.label} aria-label={x.label} className={btn(tool === x.t)} onClick={() => setTool(x.t)}><Icon n={x.n} size={18} /></button></span>))}
        <span className="mx-1 h-5 w-px bg-[#ffffff26]" />
        <button title="Image" aria-label="Image" className={btn(false)} onClick={() => img.current?.click()}><Icon n="image" size={18} /></button>
        <button title="Resume elements: photo, skill bar, icons" aria-label="Resume elements" className={btn(open)} onClick={() => setOpen(!open)}><Icon n="star" size={18} /></button>
      </div>
      <input ref={img} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addImg(f); e.target.value = '' }} />
      <input ref={photo} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addImg(f, true); e.target.value = '' }} />
    </div>
  )
}

export function ZoomControl({ z, zoomBy, fit, actual }: { z: number; zoomBy: (f: number) => void; fit: () => void; actual: () => void }) {
  const b = 'grid h-7 w-7 place-items-center rounded-md text-slate-700 hover:bg-slate-100'
  return (
    <div className="absolute right-2 top-2 z-30 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md lg:bottom-4 lg:right-4 lg:top-auto print:hidden">
      <button className={b} title="Zoom out (Ctrl -)" onClick={() => zoomBy(1 / 1.2)}><Icon n="minus" /></button>
      <button className="w-11 text-center text-xs font-medium text-slate-800" title="100% (Ctrl 1)" onClick={actual}>{Math.round(z * 100)}%</button>
      <button className={b} title="Zoom in (Ctrl +)" onClick={() => zoomBy(1.2)}><Icon n="plus" /></button>
      <button className={b} title="Fit to width (Ctrl 0)" onClick={fit}><Icon n="fit" /></button>
    </div>
  )
}
