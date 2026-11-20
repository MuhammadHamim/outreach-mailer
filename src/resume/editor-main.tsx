// Entry for the resume editor page. The editor itself (src/resume/editor, canvas, render, ...) is unchanged;
// this file only loads one resume from the server and hands it to <Editor>.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor } from './editor/Editor'
import { DialogHost } from './core/confirm'
import { applyTheme, getTheme } from './core/theme'
import type { Rec } from './core/data'
import * as api from './core/api'
import './core/fontFaces'
import './index.css'

try { if (!localStorage.getItem('rm_theme')) localStorage.setItem('rm_theme', 'dark') } catch { /* ignore */ } // same default as the app
applyTheme(getTheme())

// Desktop app: "Download PDF" opens a Save dialog and writes a real (vector) PDF instead of the system print dialog.
const desk = (window as unknown as { desktop?: { printPdf?: (title: string) => Promise<unknown> } }).desktop
if (desk?.printPdf) window.print = () => { desk.printPdf!(document.title).catch(() => {}) }

const back = () => { location.href = '/resumes' }

function App() {
  const id = new URLSearchParams(location.search).get('id') || ''
  const [r, setR] = useState<Rec | null | undefined>(undefined)
  useEffect(() => { api.get(id).then(setR).catch(() => setR(null)) }, [id])
  if (r === undefined) return <p className="p-8 text-slate-500">Loading…</p>
  if (!r) return <main className="mx-auto max-w-xl p-8"><p>Resume not found.</p><button className="mt-3 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white" onClick={back}>Back to Resumes</button></main>
  return <Editor key={r.id} user={api.LOCAL_USER} init={r} onBack={back} />
}

createRoot(document.getElementById('root')!).render(<><App /><DialogHost /></>)
