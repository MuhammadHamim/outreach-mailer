import { useEffect, useState } from 'react';
import { Send, Save, Clock } from 'lucide-react';
import { api } from './api.js';
import { Field, Modal, useToast } from './ui.jsx';

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const when = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

export default function ComposeModal({ docs = [], onClose, onDone }) {
  const [to, setTo] = useState(''), [toName, setToName] = useState(''), [subject, setSubject] = useState(''), [body, setBody] = useState('');
  const [attach, setAttach] = useState(new Set()), [mode, setMode] = useState('now'), [at, setAt] = useState(localInput(new Date(Date.now() + 3600e3)));
  const [prev, setPrev] = useState([]), [showPrev, setShowPrev] = useState(false), [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const key = to.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(key)) { setPrev([]); return; }
    const t = setTimeout(() => api.post('/api/emails/check-duplicates', { addresses: [key] }).then((d) => setPrev(d[key] || [])).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [to]);

  const sentBefore = prev.filter((d) => ['sent', 'replied'].includes(d.status));
  const ready = /^\S+@\S+\.\S+$/.test(to.trim()) && subject.trim() && body.trim() && (mode !== 'schedule' || at);
  const go = async () => {
    setBusy(true);
    try {
      await api.post('/api/emails', { to, toName, subject, body, attachments: [...attach], mode, sendAt: mode === 'schedule' ? new Date(at).getTime() : undefined });
      onDone(mode === 'now' ? 'Queued — sending now' : mode === 'schedule' ? 'Email scheduled' : 'Draft saved');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <Modal title="New email" onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !ready} onClick={go}>
          {mode === 'draft' ? <><Save size={16} /> Save draft</> : mode === 'schedule' ? <><Clock size={16} /> Schedule</> : <><Send size={16} /> {busy ? 'Sending…' : 'Send now'}</>}
        </button>
      </>
    }>
      <div className="form-grid">
        <Field label="To *"><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" autoFocus /></Field>
        <Field label="Recipient name (optional)"><input value={toName} onChange={(e) => setToName(e.target.value)} /></Field>
      </div>
      {sentBefore.length > 0 && (
        <div className="banner warn">
          <span>You already emailed this address on <b>{when(sentBefore[0].sentAt)}</b> (“{sentBefore[0].subject}”).{' '}
            <button className="linkbtn" onClick={() => setShowPrev(!showPrev)}>{showPrev ? 'Hide' : 'View what you sent'}</button></span>
        </div>
      )}
      {showPrev && sentBefore.map((d) => (
        <div key={d.id} className="preview"><div className="small muted">{when(d.sentAt)} · {d.status}</div><strong>{d.subject}</strong><pre>{d.body}</pre></div>
      ))}
      <Field label="Subject *"><input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message *"><textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <h4>Attachments</h4>
      {!docs.length ? <p className="muted small">No documents uploaded yet (Documents page).</p> :
        <div className="chips">{docs.map((d) => <label key={d.id} className={`chip ${attach.has(d.id) ? 'on' : ''}`}><input type="checkbox" hidden checked={attach.has(d.id)} onChange={() => setAttach((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })} />{d.name}</label>)}</div>}
      <h4>When</h4>
      <div className="seg">{[['now', 'Send now'], ['schedule', 'Schedule'], ['draft', 'Save as draft']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
      {mode === 'schedule' && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} style={{ marginTop: 8 }} />}
      {mode === 'schedule' && <p className="hint">Uses your computer's local time.</p>}
    </Modal>
  );
}
