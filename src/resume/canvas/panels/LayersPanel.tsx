import type { Data } from '../../core/data'
import { getByEid } from '../../core/data'
import { Icon, type IconName } from '../../ui/icons'
import { IconBtn } from '../../ui/kit'
import { listNodes, pages } from '../dom'
import type { DesignApi } from '../types'

const flowLabel = (d: Data, id: string) => (id.endsWith('.rule') ? 'Divider' : id.endsWith('.tags') ? 'Tags' : (getByEid(d, id) || id).slice(0, 36))
const flowIcon = (id: string): IconName => (id.endsWith('.rule') ? 'line' : 'text')

function Row({ id, icon, text, api, hidden, locked }: { id: string; icon: IconName; text: string; api: DesignApi; hidden?: boolean; locked?: boolean }) {
  const sel = api.sel.includes(id)
  return (
    <div className={'group flex h-7 items-center gap-1.5 px-2 text-xs ' + (sel ? 'bg-sky-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100') + (hidden ? ' opacity-50' : '')}>
      <span className="text-slate-500"><Icon n={icon} size={14} /></span>
      <button className="min-w-0 flex-1 truncate text-left" onClick={(e) => api.pick(id, e.shiftKey || e.metaKey || e.ctrlKey)}>{text}</button>
      <button title={locked ? 'Unlock' : 'Lock'} className={locked ? 'text-slate-700' : 'text-slate-500 opacity-0 group-hover:opacity-100'} onClick={() => api.lock([id], !locked)}><Icon n={locked ? 'lock' : 'unlock'} size={13} /></button>
      <button title={hidden ? 'Show' : 'Hide'} className={hidden ? 'text-slate-700' : 'text-slate-500 opacity-0 group-hover:opacity-100'} onClick={() => api.hide([id], !hidden)}><Icon n={hidden ? 'eyeoff' : 'eye'} size={13} /></button>
    </div>
  )
}

/** Left panel: pages and the layer list of the current page (free objects on top, template content below). */
export function LayersPanel({ d, api }: { d: Data; api: DesignApi }) {
  const pgs = pages(), flow = listNodes(api.cpage).filter((n) => !n.id.startsWith('o_'))
  const objs = [...(d.layout?.pages[api.cpage]?.objects || [])].reverse()
  const hidden = Object.entries(d.fmt || {}).filter(([, f]) => f.hidden).map(([id]) => id)
  return (
    <div className="text-slate-800">
      <div className="flex items-center border-b border-slate-200 px-3 py-2"><span className="text-[11px] font-semibold">Pages</span><span className="ml-auto"><IconBtn n="plus" title="Add page" onClick={api.addPage} /></span></div>
      <div className="border-b border-slate-200 py-1">
        {pgs.map((pg, i) => (
          <div key={i} className={'group flex h-7 items-center gap-1.5 px-2 text-xs ' + (api.cpage === i ? 'bg-sky-100' : 'hover:bg-slate-100')}>
            <span className="text-slate-500"><Icon n="page" size={14} /></span>
            <button className="flex-1 text-left" onClick={() => { api.setPage(i); pg.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>Page {i + 1}</button>
            {pg.hasAttribute('data-blank') && <button title="Delete blank page" className="text-slate-500 opacity-0 group-hover:opacity-100" onClick={() => api.delPage(i)}><Icon n="trash" size={13} /></button>}
          </div>
        ))}
      </div>
      <div className="px-3 py-2 text-[11px] font-semibold">Layers</div>
      <div className="pb-3">
        {objs.map((o) => <Row key={o.id} id={o.id} icon={o.type === 'rect' ? (o.radius && o.radius >= 99 ? 'ellipse' : 'rect') : o.type === 'icon' ? 'star' : o.type} text={o.type === 'text' ? o.text || 'Text' : o.type === 'rect' ? (o.radius && o.radius >= 99 ? 'Ellipse' : 'Rectangle') : o.type[0].toUpperCase() + o.type.slice(1)} api={api} hidden={o.hidden} locked={o.locked} />)}
        {flow.map((n) => <Row key={n.id} id={n.id} icon={flowIcon(n.id)} text={flowLabel(d, n.id)} api={api} locked={!!d.fmt?.[n.id]?.locked} />)}
        {hidden.map((id) => <Row key={id} id={id} icon={flowIcon(id)} text={flowLabel(d, id)} api={api} hidden />)}
        {!objs.length && !flow.length && <p className="px-3 text-xs text-slate-500">Nothing on this page.</p>}
      </div>
    </div>
  )
}
