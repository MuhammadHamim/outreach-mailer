import type { AlignMode } from '../core/geometry'
import type { Fmt } from '../core/data'
import type { StyleP } from '../core/ops'
import type { Tool, ViewOpts } from '../render'
import type { Props } from './adapter'

/** The actions the inspector, layers panel and menus can trigger. Implemented once in editor/useDesign. */
export type DesignApi = {
  sel: string[]; cpage: number; tool: Tool
  setTool: (t: Tool) => void; setPage: (n: number) => void
  pick: (id: string | null, additive?: boolean) => void
  select: (ids: string[]) => void; selectAll: () => void
  setProps: (p: Partial<Props>) => void        // edit the single selected element
  setFmt: (id: string, p: Fmt) => void; clearFmt: (id: string) => void
  style: (s: StyleP) => void                    // style every selected element
  del: () => void; dup: () => void; copy: () => void; paste: () => void
  group: () => void; ungroup: () => void
  lock: (ids: string[], b: boolean) => void; hide: (ids: string[], b: boolean) => void
  order: (k: 'front' | 'back' | 'up' | 'down') => void
  align: (m: AlignMode) => void; distribute: (axis: 'h' | 'v') => void
  pageBg: (c: string) => void; replaceImg: (f: File) => void; resetAll: () => void
  addPage: () => void; delPage: (i: number) => void
  snap: { on: boolean; grid: number }; setSnap: (s: { on: boolean; grid: number }) => void
  view: ViewOpts; setView: (v: ViewOpts) => void
}
