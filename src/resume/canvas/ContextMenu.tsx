import { useEffect } from 'react'
import type { DesignApi } from './types'

/** Right-click menu (opens on a right click without dragging; right-drag pans). */
export function ContextMenu({ x, y, api, onClose }: { x: number; y: number; api: DesignApi; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose(), key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    setTimeout(() => addEventListener('pointerdown', close), 0); addEventListener('keydown', key); addEventListener('wheel', close)
    return () => { removeEventListener('pointerdown', close); removeEventListener('keydown', key); removeEventListener('wheel', close) }
  }, [])
  const has = api.sel.length > 0, many = api.sel.length > 1
  const items: ([string, string, () => void, boolean] | 'sep')[] = [
    ['Copy', 'Ctrl+C', api.copy, has], ['Paste', 'Ctrl+V', api.paste, true], ['Duplicate', 'Ctrl+D', api.dup, has], ['Delete', 'Del', api.del, has], 'sep',
    ['Group', 'Ctrl+G', api.group, many], ['Ungroup', 'Ctrl+Shift+G', api.ungroup, has], 'sep',
    ['Bring to front', 'Ctrl+Shift+]', () => api.order('front'), has], ['Send to back', 'Ctrl+Shift+[', () => api.order('back'), has], 'sep',
    ['Lock', '', () => api.lock(api.sel, true), has], ['Hide', '', () => api.hide(api.sel, true), has], 'sep', ['Select all', 'Ctrl+A', api.selectAll, true],
  ]
  return (
    <div className="anim-fade fixed z-[90] w-56 rounded-lg bg-[#2c2c2c] py-1 text-xs text-white shadow-2xl print:hidden" style={{ left: Math.min(x, innerWidth - 232), top: Math.min(y, innerHeight - 380) }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) => it === 'sep' ? <div key={i} className="my-1 h-px bg-[#ffffff1a]" /> : (
        <button key={it[0]} disabled={!it[3]} onClick={() => { it[2](); onClose() }} className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-[#0d99ff] disabled:opacity-40 disabled:hover:bg-transparent"><span>{it[0]}</span><span className="text-[#ffffff80]">{it[1]}</span></button>
      ))}
    </div>
  )
}
