// Keyboard shortcuts (Figma-style). Zoom works everywhere; the rest only in design mode.
import { useEffect, type MutableRefObject } from 'react'
import type { VPApi } from '../canvas/Viewport'
import type { Design } from './useDesign'
import type { Doc } from './useDocument'

export const SHORTCUTS = `Tools: V move · H hand · R rectangle · O ellipse · L line · T text
Select: click · Shift/Ctrl-click or drag a box to add · Ctrl+A all
Move: drag · arrow keys (Shift = 10px)
Edit text: double-click / double-tap
Delete: Del (template content is hidden, free elements removed)
Duplicate: Ctrl+D · Copy / Paste: Ctrl+C / Ctrl+V
Group / Ungroup: Ctrl+G / Ctrl+Shift+G
Layer order: Ctrl+] / [ one step · Ctrl+Shift+] / [ front / back
Undo / Redo: Ctrl+Z / Ctrl+Shift+Z
Draw: pick a tool, then drag on the page (Shift = square / 15° angle)
Resize: handles (Shift keeps proportions) · Rotate: drag just outside a corner
Zoom: Ctrl + wheel · Ctrl + / - · Ctrl+0 or Shift+1 fit · Ctrl+1 or Shift+0 100%
Pan: right-drag, middle-drag, or Space + drag · Right-click opens the menu`

export function useShortcuts(doc: Doc, dz: Design, vp: MutableRefObject<VPApi | null>, onUndoRedo: () => void) {
  useEffect(() => {
    const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement; return /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable }
    const { api } = dz
    const down = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase()
      if (mod && (k === '+' || k === '=')) { e.preventDefault(); vp.current?.zoomBy(1.2); return }
      if (mod && k === '-') { e.preventDefault(); vp.current?.zoomBy(1 / 1.2); return }
      if (mod && k === '0') { e.preventDefault(); vp.current?.fit(); return }
      if (mod && k === '1') { e.preventDefault(); vp.current?.actual(); return }
      if (typing(e)) return
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey ? doc.redo() : doc.undo()) onUndoRedo(); return }
      if (mod && k === 'y') { e.preventDefault(); if (doc.redo()) onUndoRedo(); return }
      if (!dz.design || dz.editing) return
      if (k === ' ') { e.preventDefault(); dz.setHand(true); return }
      if (!mod && !e.altKey) { const tl = ({ v: 'move', h: 'hand', r: 'rect', o: 'ellipse', l: 'line', t: 'text' } as const)[k as 'v']; if (tl && !e.shiftKey) { dz.setTool(tl); return } }
      if (e.shiftKey && !mod && e.key === '!') { vp.current?.fit(); return }
      if (e.shiftKey && !mod && e.key === ')') { vp.current?.actual(); return }
      if (k === 'enter' && api.sel.length === 1) { e.preventDefault(); dz.startEdit(api.sel[0]); return }
      if (e.key === 'Escape' && dz.tool !== 'move') { dz.setTool('move'); return }
      if (mod && k === 'a') { e.preventDefault(); api.selectAll(); return }
      if (mod && k === 'v') { e.preventDefault(); api.paste(); return }
      if (!api.sel.length) return
      if (mod && k === 'c') { e.preventDefault(); api.copy() }
      else if (mod && k === 'x') { e.preventDefault(); api.copy(); api.del() }
      else if (mod && k === 'd') { e.preventDefault(); api.dup() }
      else if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? api.ungroup() : api.group() }
      else if (mod && e.shiftKey && (e.key === ']' || e.key === '}')) { e.preventDefault(); api.order('front') }
      else if (mod && e.shiftKey && (e.key === '[' || e.key === '{')) { e.preventDefault(); api.order('back') }
      else if (mod && e.key === ']') { e.preventDefault(); api.order('up') }
      else if (mod && e.key === '[') { e.preventDefault(); api.order('down') }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); api.del() }
      else if (e.key === 'Escape') api.pick(null)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault(); const s = e.shiftKey ? 10 : 1
        dz.nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0)
      }
    }
    const up = (e: KeyboardEvent) => { if (e.key === ' ') dz.setHand(false) }
    addEventListener('keydown', down); addEventListener('keyup', up)
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up) }
  })
}
