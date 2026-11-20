import { useEffect, useState } from 'react'
export type Theme = 'light' | 'dark' | 'system'
const KEY = 'rm_theme'
export const getTheme = (): Theme => { try { return (localStorage.getItem(KEY) as Theme) || 'system' } catch { return 'system' } }
export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  document.documentElement.classList.add('theme-anim')
  applyTheme(t)
  dispatchEvent(new Event('themechange'))
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 350)
}
export function useTheme() {
  const [t, s] = useState(getTheme)
  useEffect(() => {
    const f = () => s(getTheme()), mq = matchMedia('(prefers-color-scheme: dark)'), g = () => applyTheme(getTheme())
    addEventListener('themechange', f); mq.addEventListener('change', g)
    return () => { removeEventListener('themechange', f); mq.removeEventListener('change', g) }
  }, [])
  return t
}
export function ThemeBtn() {
  useTheme()
  const dark = document.documentElement.classList.contains('dark')
  return (
    <button aria-label="Toggle dark mode" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 active:scale-90">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />}
      </svg>
    </button>
  )
}
