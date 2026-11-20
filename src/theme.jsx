import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

// One preference shared with the resume editor (same localStorage key): 'dark' (default) | 'light' | 'system'
const KEY = 'rm_theme';
export const getPref = () => { try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; } };
export function applyTheme(pref = getPref()) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export function setPref(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  applyTheme(pref); dispatchEvent(new Event('themechange'));
}

export function ThemeSwitch({ labels = false }) {
  const [pref, setP] = useState(getPref);
  useEffect(() => {
    const f = () => setP(getPref()), mq = matchMedia('(prefers-color-scheme: dark)'), g = () => applyTheme();
    addEventListener('themechange', f); mq.addEventListener('change', g);
    return () => { removeEventListener('themechange', f); mq.removeEventListener('change', g); };
  }, []);
  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {[['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'Auto', Monitor]].map(([k, l, Icon]) => (
        <button key={k} className={pref === k ? 'on' : ''} onClick={() => setPref(k)} title={`${l} theme`} aria-label={`${l} theme`}><Icon size={15} />{labels && l}</button>
      ))}
    </div>
  );
}
