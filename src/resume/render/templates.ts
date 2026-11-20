import type { Data } from '../core/data'
import { FONTS } from '../core/fonts'

export type Base = { name: string; font: string; accent: string; ink: string; size: number; center?: boolean; head: 'rule' | 'bar' | 'caps' | 'small'; side?: boolean; gap: number; photo?: 'top' | 'band' | 'grid' | 'side'; shape?: 'circle' | 'rounded' | 'square'; psize?: number }
export type Resolved = Base & { lh: number; margin: number; icons: boolean; headerGap: number }

// Add a new resume format = add one entry here.
export const TEMPLATES: Record<string, Base> = {
  classic: { name: 'Classic (Default)', font: "Georgia,'Times New Roman',serif", accent: '#1e3a8a', ink: '#111827', size: 12, center: true, head: 'rule', gap: 10 },
  modern: { name: 'Modern', font: "'Helvetica Neue',Arial,sans-serif", accent: '#0f766e', ink: '#0f172a', size: 11.5, head: 'bar', gap: 10 },
  compact: { name: 'Compact ATS (dense)', font: 'Arial,Helvetica,sans-serif', accent: '#111827', ink: '#111827', size: 10.5, head: 'caps', gap: 6 },
  sidebar: { name: 'Executive Sidebar', font: "Calibri,'Segoe UI',Arial,sans-serif", accent: '#1e293b', ink: '#0f172a', size: 11.5, side: true, head: 'rule', gap: 10 },
  elegant: { name: 'Elegant', font: "Garamond,'Palatino Linotype',Georgia,serif", accent: '#9a3412', ink: '#1c1917', size: 12.5, center: true, head: 'caps', gap: 10 },
  photoClassic: { name: 'Photo · Classic (photo)', font: "Lato,'Microsoft YaHei',sans-serif", accent: '#1e3a8a', ink: '#111827', size: 11.5, head: 'rule', gap: 10, photo: 'top', shape: 'rounded', psize: 30 },
  photoSidebar: { name: 'Photo · Sidebar (photo)', font: "'Open Sans','Microsoft YaHei',sans-serif", accent: '#0f3d3e', ink: '#0f172a', size: 11, side: true, head: 'rule', gap: 10, photo: 'side', shape: 'circle', psize: 38 },
  photoBand: { name: 'Photo · Header band (photo)', font: "Roboto,'Microsoft YaHei',sans-serif", accent: '#2563eb', ink: '#0f172a', size: 11, head: 'bar', gap: 10, photo: 'band', shape: 'circle', psize: 30 },
  infoGrid: { name: 'Info grid · 中文简历 (photo)', font: "'Microsoft YaHei','PingFang SC',Roboto,sans-serif", accent: '#1d4ed8', ink: '#111827', size: 11, head: 'rule', gap: 10, photo: 'grid', shape: 'square', psize: 28 },
  academic: { name: 'Academic CV (Masters / PhD)', font: "'Times New Roman',Times,serif", accent: '#000000', ink: '#000000', size: 12, center: true, head: 'small', gap: 10 },
}

/** Template defaults + the user's document-level style overrides. */
export function resolve(d: Data, tpl: string): Resolved {
  const b = TEMPLATES[tpl] || TEMPLATES.classic, s = d.style || {}
  return { ...b, size: s.size ?? b.size, accent: s.accent || b.accent, font: FONTS[s.font || '']?.[1] || b.font, gap: s.gap ?? b.gap, lh: s.lineHeight ?? 1.45, margin: s.margin ?? 12, center: s.align ? s.align === 'center' : b.center,
    icons: !!s.icons, headerGap: s.headerGap ?? 0, shape: s.photoShape || b.shape || 'rounded', psize: s.photoSize ?? b.psize ?? 30 }
}
