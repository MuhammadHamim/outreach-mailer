// Small shared UI kit: class tokens and form controls used across the app.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:text-sm'
export const btn = 'inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition active:scale-[.97] disabled:opacity-50 '
export const pri = btn + 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
export const sec = btn + 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
export const mini = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50'
export const lab = 'text-xs font-medium text-slate-600'
export const card = 'space-y-2 rounded-xl border border-slate-200 bg-white p-3'
export const chip = (on: boolean) => 'rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95 ' + (on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')

/** Compact toolbar / toggle button. */
export function B({ on, ...p }: { on?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={'shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ' + (on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')} />
}
export const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-300" />

export function F({ l, v, on, area }: { l: string; v?: string; on: (s: string) => void; area?: boolean }) {
  return (
    <label className="block">
      <span className={lab}>{l}</span>
      {area ? <textarea rows={4} className={inp} value={v ?? ''} onChange={(e) => on(e.target.value)} /> : <input className={inp} value={v ?? ''} onChange={(e) => on(e.target.value)} />}
    </label>
  )
}
export function Num({ l, v, on, step = 1, min }: { l: string; v: number; on: (n: number) => void; step?: number; min?: number }) {
  return <label className="block"><span className={lab}>{l}</span><input type="number" className={inp} step={step} min={min} value={Number.isFinite(v) ? Math.round(v * 100) / 100 : 0} onChange={(e) => on(+e.target.value)} /></label>
}
export function Rg({ l, v, min, max, step, on }: { l: string; v: number; min: number; max: number; step: number; on: (n: number) => void }) {
  return <label className="block"><span className={lab}>{l}: <b>{v}</b></span><input type="range" className="w-full accent-indigo-600" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} /></label>
}
const SWATCHES = ['#111827', '#1e3a8a', '#0f766e', '#9a3412', '#7c3aed', '#be123c', '#475569', '#ffffff']
export function Col({ l, v, on, extra }: { l: string; v?: string; on: (c: string) => void; extra?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2"><span className={lab + ' flex-1'}>{l}</span>{extra}<input type="color" value={/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000'} onChange={(e) => on(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white" /></div>
      <div className="flex gap-1">{SWATCHES.map((c) => <button key={c} aria-label={c} onClick={() => on(c)} className="h-5 w-5 rounded-full border border-slate-300" style={{ background: c }} />)}</div>
    </div>
  )
}

// ---------- Figma-style inspector controls ----------
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="border-b border-slate-200 px-3 py-3"><div className="mb-2 flex items-center text-[11px] font-semibold text-slate-800">{title}<span className="ml-auto flex items-center gap-0.5">{action}</span></div><div className="space-y-2">{children}</div></section>
}
/** Number field with the label inside (X, Y, W, H, ...). */
export function NF({ l, v, on, step = 1, min, max, title }: { l: ReactNode; v: number; on: (n: number) => void; step?: number; min?: number; max?: number; title?: string }) {
  return (
    <label title={title} className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-slate-100 px-2 text-xs hover:border-slate-300 focus-within:border-sky-500 focus-within:bg-white">
      <span className="w-3 shrink-0 text-center text-slate-500">{l}</span>
      <input type="number" step={step} min={min} max={max} className="min-w-0 flex-1 bg-transparent text-[16px] text-slate-900 outline-none sm:text-xs" value={Number.isFinite(v) ? Math.round(v * 100) / 100 : 0} onChange={(e) => on(+e.target.value)} />
    </label>
  )
}
export function IconBtn({ n, on, size = 16, ...p }: { n: IconName; on?: boolean; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={'grid h-7 w-7 shrink-0 place-items-center rounded-md transition disabled:opacity-35 ' + (on ? 'bg-sky-100 text-sky-600' : 'text-slate-700 hover:bg-slate-100')}><Icon n={n} size={size} /></button>
}
export function Seg({ items, v, on }: { items: { k: string; n: IconName; t: string }[]; v?: string; on: (k: string) => void }) {
  return <div className="flex gap-0.5 rounded-md bg-slate-100 p-0.5">{items.map((i) => <button key={i.k} title={i.t} onClick={() => on(i.k)} className={'grid h-7 flex-1 place-items-center rounded ' + (v === i.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}><Icon n={i.n} /></button>)}</div>
}
export function SelF({ v, on, children }: { v: string; on: (v: string) => void; children: ReactNode }) {
  return <select value={v} onChange={(e) => on(e.target.value)} className="h-8 w-full rounded-md border border-transparent bg-slate-100 px-2 text-[16px] text-slate-900 outline-none hover:border-slate-300 focus:border-sky-500 sm:text-xs">{children}</select>
}
/** Colour swatch + hex + (optional) opacity, like Figma's Fill row. */
export function ColorRow({ v, on, opacity, onOpacity }: { v?: string; on: (c: string) => void; opacity?: number; onOpacity?: (o: number) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(v || '') ? (v as string) : '#000000'
  return (
    <div className="flex h-8 items-center gap-2 rounded-md bg-slate-100 px-2 hover:bg-slate-200/70">
      <label className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm border border-black/10" style={{ background: hex }}><input type="color" value={hex} onChange={(e) => on(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>
      <input className="min-w-0 flex-1 bg-transparent text-[16px] uppercase text-slate-900 outline-none sm:text-xs" value={hex.slice(1)} onChange={(e) => /^[0-9a-f]{6}$/i.test(e.target.value) && on('#' + e.target.value)} maxLength={6} />
      {onOpacity && <><input type="number" min={0} max={100} className="w-9 bg-transparent text-right text-[16px] text-slate-900 outline-none sm:text-xs" value={Math.round((opacity ?? 1) * 100)} onChange={(e) => onOpacity(Math.min(1, Math.max(0, +e.target.value / 100)))} /><span className="text-xs text-slate-500">%</span></>}
    </div>
  )
}
