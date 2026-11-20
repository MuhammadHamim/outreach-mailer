import { useState } from 'react';
import { Send, Lock } from 'lucide-react';
import { api } from '../api.js';

export default function Login({ onDone }) {
  const [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post('/api/login', { password }); onDone(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <span className="logo big"><Send size={22} /></span>
        <h1>Outreach Mailer</h1>
        <p className="muted">Sign in to manage and schedule your emails.</p>
        <div className="input-icon"><Lock size={16} /><input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <div className="form-err">{err}</div>}
        <button className="btn primary full" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
