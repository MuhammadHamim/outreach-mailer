import { createContext } from 'react'
import type { Fmt, Obj } from '../core/data'
import type { Geo } from '../core/ops'

export type Guides = { pg: number; v: number[]; h: number[] } | null
export type Marquee = { pg: number; x: number; y: number; w: number; h: number } | null
export type Tool = 'move' | 'hand' | 'rect' | 'ellipse' | 'line' | 'text'
export type ViewOpts = { grid: boolean; margins: boolean }

/** Everything the rendered resume needs to be interactive. The editor provides it; read-only views leave it out. */
export type Ctx = {
  on: boolean; hand: boolean; sel: string[]; editing: string | null; fmt: Record<string, Fmt>
  pick: (id: string | null, additive?: boolean) => void
  select: (ids: string[]) => void
  expand: (ids: string[]) => string[]
  edit: (id: string | null) => void
  commit: (id: string, v: string) => void
  geo: (items: Geo[]) => void
  patchObj: (id: string, p: Partial<Obj>) => void
  snap: { on: boolean; grid: number }; scale: number
  guides: Guides; setGuides: (g: Guides) => void
  marquee: Marquee; setMarquee: (m: Marquee) => void
  setPage: (n: number) => void; view: ViewOpts
  tool: Tool; setTool: (t: Tool) => void; gesture: () => void
  beginDraw: (pi: number, tool: Tool, x: number, y: number) => string
}
const NOOP = () => {}
export const BASE: Ctx = {
  on: false, hand: false, sel: [], editing: null, fmt: {}, pick: NOOP, select: NOOP, expand: (i) => i, edit: NOOP, commit: NOOP, geo: NOOP, patchObj: NOOP,
  snap: { on: false, grid: 4 }, scale: 1, guides: null, setGuides: NOOP, marquee: null, setMarquee: NOOP, setPage: NOOP, view: { grid: false, margins: false }, tool: 'move', setTool: NOOP, gesture: NOOP, beginDraw: () => '',
}
export const EditCtx = createContext<Partial<Ctx> | null>(null) // provided by the editor
export const Cx = createContext<Ctx>(BASE) // resolved inside <Paper>
