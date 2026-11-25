import { useRef, useState } from 'react'
import { tell } from '../core/confirm'
import * as api from '../core/api'
import type { Rec } from '../core/data'
import { pdfFile } from '../core/pdf'
import { ThemeBtn } from '../core/theme'
import { ContextMenu } from '../canvas/ContextMenu'
import { nodeId } from '../canvas/dom'
import { Inspector } from '../canvas/panels/Inspector'
import { LayersPanel } from '../canvas/panels/LayersPanel'
import { Toolbar, ZoomControl } from '../canvas/Toolbar'
import { Viewport, useZoom, type VPApi } from '../canvas/Viewport'
import { EditCtx, Paper, TEMPLATES } from '../render'
import { Icon } from '../ui/icons'
import { IconBtn, inp, pri, sec } from '../ui/kit'
import { FormPane } from './FormPane'
import { JsonModal } from './JsonModal'
import { useDesign } from './useDesign'
import { useDocument } from './useDocument'
import { SHORTCUTS, useShortcuts } from './useShortcuts'

/** Composes the editor: header, content form (normal mode), Figma-style layers / canvas / inspector (design mode). */
export function Editor({ user, init, onBack }: { user: api.User; init: Rec; onBack: () => void }) {
  const doc = useDocument(init, (r) => api.save(user.uid, r))
  const zoom = useZoom(), vp = useRef<VPApi | null>(null)
  const dz = useDesign(doc, zoom.z)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit'), [json, setJson] = useState(false), [busy, setBusy] = useState(false), [bar, setBar] = useState(false)
  const [sheet, setSheet] = useState<'design' | 'layers'>('design'), [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const { rec, d } = doc, design = dz.design
  useShortcuts(doc, dz, vp, () => dz.api.pick(null))

  const exportPdf = async (print: boolean) => {
    await dz.clearSel()
    const pdfApi = (window as any).desktopPdf // desktop app only: real text PDF + the resume data embedded for re-import
    if (print && pdfApi?.print) {
      setBusy(true)
      try {
        await new Promise((r) => setTimeout(r, 150)) // let the selection chrome disappear before printing
        const { savePdfWithData } = await import('../core/pdfImport')
        await savePdfWithData(await pdfApi.print(), rec.name, { template: rec.template, ...d })
      } catch (e) { tell('PDF export failed: ' + (e as Error).message) }
      setBusy(false); return
    }
    if (print && window.self === window.top) { const o = document.title; document.title = rec.name || 'resume'; window.print(); document.title = o; return }
    setBusy(true); try { await pdfFile(rec.name, { template: rec.template, ...d }) } catch (e) { tell('PDF export failed: ' + (e as Error).message) } setBusy(false)
  }
  const onContext = (x: number, y: number) => {
    if (!design) return
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-eid],[data-rule],[data-oid]'), id = el && nodeId(el)
    if (id && !el.dataset.locked && !dz.api.sel.includes(id)) dz.api.pick(id)
    setMenu({ x, y })
  }
  const undo = () => doc.undo() && dz.api.pick(null), redo = () => doc.redo() && dz.api.pick(null)
  const layers = <LayersPanel d={d} api={dz.api} />, inspector = <Inspector d={d} api={dz.api} z={zoom.z} />
  return (
    <div className="flex h-dvh flex-col bg-slate-50 print:block print:h-auto print:bg-white">
      <header className="border-b border-slate-200 bg-white px-2 py-1.5 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <IconBtn n="chevron" title="Back to My Resumes" aria-label="Back" onClick={async () => { if (!doc.saved) await doc.flush(); onBack() }} style={{ transform: 'rotate(90deg)' }} />
          <IconBtn n="undo" title="Undo (Ctrl+Z)" disabled={!doc.canUndo} onClick={undo} /><IconBtn n="redo" title="Redo (Ctrl+Shift+Z)" disabled={!doc.canRedo} onClick={redo} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 lg:hidden">{rec.name}</span>
          <span className="text-xs text-slate-500 lg:hidden">{doc.saved ? 'Saved' : 'Saving…'}</span>
          <button className={'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ' + (design ? 'bg-[#0d99ff] text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')} onClick={() => dz.setDesign(!design)} title="Design mode: edit visually like Figma"><Icon n="move" size={14} />Design</button>
          {!design && <button className={sec + ' !h-8 !px-2.5 !text-xs lg:hidden'} onClick={() => setTab(tab === 'edit' ? 'preview' : 'edit')}>{tab === 'edit' ? 'Preview' : 'Edit'}</button>}
          <button className={sec + ' !h-8 !px-2.5 !text-xs lg:hidden'} aria-label="Toggle toolbar" aria-expanded={bar} onClick={() => setBar(!bar)}>{bar ? '✕' : '☰'}</button>
          <div className={`${bar ? 'flex' : 'hidden'} w-full flex-col gap-2 lg:flex lg:w-auto lg:flex-1 lg:flex-row lg:items-center`}>
            <input className={inp + ' !h-8 !text-xs lg:max-w-48'} value={rec.name} onChange={(e) => doc.patch((r) => ({ ...r, name: e.target.value }))} aria-label="Resume name" />
            <select className={inp + ' !h-8 !text-xs lg:max-w-56'} value={rec.template} onChange={(e) => doc.patch((r) => ({ ...r, template: e.target.value }))}>{Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select>
            <span className="hidden text-xs text-slate-500 lg:inline">{doc.saved ? 'Saved' : 'Saving…'}</span>
            <div className="flex flex-wrap items-center gap-1.5 lg:ml-auto">
              <ThemeBtn />
              <button className={sec + ' !h-8 !px-2.5 !text-xs'} onClick={() => setJson(true)}><Icon n="code" size={14} />&nbsp;JSON</button>
              {window.self === window.top && <button className={sec + ' !h-8 !px-2.5 !text-xs'} disabled={busy} onClick={() => exportPdf(false)} title="Direct file download (pages as images)">PDF file</button>}
              <button className={pri + ' !h-8 !px-3 !text-xs'} disabled={busy} onClick={() => exportPdf(true)}>{busy ? 'Preparing…' : 'Download PDF'}</button>
            </div>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 print:block">
        {design && <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block print:hidden">{layers}</aside>}
        <aside className={`${tab === 'edit' && !design ? 'block' : 'hidden'} w-full shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3 ${design ? 'lg:hidden' : 'lg:block'} lg:w-[420px] print:hidden`}>
          <FormPane d={d} tpl={rec.template} up={doc.up} edit={doc.edit} />
        </aside>
        <div className={`${tab === 'preview' || design ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex print:block`}>
          <Viewport zoom={zoom} design={design} hand={dz.hand} cursor={dz.hand ? 'grab' : dz.tool !== 'move' ? 'crosshair' : undefined} apiRef={vp} onBlank={() => dz.api.pick(null)} onContext={onContext}
            overlay={<>
              {design && <Toolbar tool={dz.tool} setTool={dz.setTool} addImg={dz.tools.addImg} addIcon={dz.tools.addIcon} addSkill={dz.tools.addSkill} />}
              <ZoomControl z={zoom.z} zoomBy={(f) => vp.current?.zoomBy(f)} fit={() => vp.current?.fit()} actual={() => vp.current?.actual()} />
              {design && <button className="absolute bottom-4 left-4 z-30 hidden h-8 w-8 place-items-center lg:grid rounded-lg border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-100 print:hidden" title="Keyboard shortcuts" onClick={() => tell(SHORTCUTS)}><Icon n="help" /></button>}
            </>}>
            <EditCtx.Provider value={dz.ctx}><Paper d={d} tpl={rec.template} /></EditCtx.Provider>
          </Viewport>
          {design && (
            <div className="max-h-[40dvh] shrink-0 overflow-y-auto border-t border-slate-200 bg-white lg:hidden print:hidden">
              <div className="sticky top-0 z-10 flex gap-1 border-b border-slate-200 bg-white p-1.5">{(['design', 'layers'] as const).map((s) => <button key={s} onClick={() => setSheet(s)} className={'flex-1 rounded-md py-1 text-xs font-semibold capitalize ' + (sheet === s ? 'bg-slate-100 text-slate-900' : 'text-slate-500')}>{s}</button>)}</div>
              {sheet === 'design' ? inspector : layers}
            </div>
          )}
        </div>
        {design && <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-slate-200 bg-white lg:block print:hidden">{inspector}</aside>}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} api={dz.api} onClose={() => setMenu(null)} />}
      {json && <JsonModal data={d} tpl={rec.template} onClose={() => setJson(false)}
        onApply={(nd) => { doc.edit((x) => ({ ...x, basics: nd.basics, sections: nd.sections, style: nd.style, fmt: nd.fmt, layout: nd.layout })); if (nd.template && TEMPLATES[nd.template]) doc.patch((r) => ({ ...r, template: nd.template! })) }} />}
    </div>
  )
}
