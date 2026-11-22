import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

export const fmtTime = (ms, tz = 'Asia/Shanghai', withDate = true) => !ms ? '-' :
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...(withDate ? { day: '2-digit', month: 'short' } : {}), hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
export const fmtSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random(); setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'err' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Badge = ({ status }) => <span className={`badge ${status}`}>{status}</span>;
export const Toggle = ({ checked, onChange, label }) => (
  <label className="toggle"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="track" /><span>{label}</span></label>
);
export const Field = ({ label, hint, children }) => (<div className="field"><span className="lbl">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</div>);
export const Empty = ({ icon, title, children }) => (<div className="empty">{icon}<h3>{title}</h3><p>{children}</p></div>);

export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null), [err, setErr] = useState(null);
  const reload = useCallback(() => fn().then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message)), deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return [data, reload, err, setData];
}
