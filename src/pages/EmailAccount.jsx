import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, ShieldCheck, ShieldAlert, Loader2, Star, TriangleAlert } from 'lucide-react';
import { api } from '../api.js';
import { Field, Modal, useLoad, useToast } from '../ui.jsx';

const bold = (t) => t.split('**').map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x));

function GuideModal({ p, onClose }) {
  return (
    <Modal title={`Connect ${p.name}`} onClose={onClose} wide footer={<button className="btn primary" onClick={onClose}>Got it</button>}>
      <div className={`banner ${p.status === 'limited' ? 'warn' : 'info'}`}>{p.status === 'limited' ? <TriangleAlert size={18} /> : <BookOpen size={18} />}<span>{p.intro}</span></div>
      <ol className="guide-list">{p.steps.map((s, i) => <li key={i}>{bold(s)}</li>)}</ol>
      {p.links.length > 0 && <div className="btn-row" style={{ margin: '4px 0 14px' }}>{p.links.map((l) => <a key={l.url} className="btn" href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {l.label}</a>)}</div>}
      <div className="srv-line">Server used: <code>{p.host || 'your own'}{p.host ? `:${p.port}` : ''}</code> · {p.security === 'ssl' ? 'SSL' : p.security === 'starttls' ? 'STARTTLS' : 'no encryption'}</div>
      {p.tips.length > 0 && <><h4>Good to know</h4><ul className="tips">{p.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
    </Modal>
  );
}

export default function EmailAccount() {
  const [providers] = useLoad(() => api.get('/api/providers'));
  const [acct, reload] = useLoad(() => api.get('/api/account'));
  const [f, setF] = useState(null), [guide, setGuide] = useState(false), [check, setCheck] = useState(null), [checking, setChecking] = useState(false);
  const toast = useToast();
  useEffect(() => { if (acct) setF({ provider: acct.provider, email: acct.email, name: acct.name, secret: '', replyTo: acct.replyTo, username: acct.username, host: acct.host, port: acct.port, security: acct.security, imapHost: acct.imapHost, imapPort: acct.imapPort }); }, [acct]);
  if (!providers || !acct || !f) return <section className="card pad"><div className="spinner" /></section>;
  if (!acct.editable) return <section className="card pad"><h3>Email account</h3><p className="muted">This server is configured through environment variables (MAIL_PROVIDER, MAIL_EMAIL, MAIL_PASSWORD).</p></section>;

  const p = providers.find((x) => x.id === f.provider) || providers[0];
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pick = (q) => { setF((x) => ({ ...x, provider: q.id, host: q.host, port: q.port, security: q.security, secret: q.id === acct.provider ? x.secret : '' })); setCheck(null); };
  const save = async () => { try { await api.put('/api/account', f); toast('Email account saved'); set('secret', ''); reload(); } catch (e) { toast(e.message, 'err'); } };
  const test = async () => { setChecking(true); setCheck(null); try { setCheck(await api.get('/api/smtp-check')); } catch (e) { setCheck({ ok: false, message: e.message }); } setChecking(false); };
  const sameProvider = p.id === acct.provider;

  return (
    <section className="card pad">
      <h3>Email account</h3>
      <p className="muted">Choose the mailbox the emails are sent from. Stored only on this computer.</p>
      <div className="banner info recommend"><Star size={16} /><span>In China? <b>QQ Mail</b> is the simplest and most reliable choice: it works without a VPN and only needs a free authorization code.{p.id !== 'qq' && <> <button className="linkbtn" onClick={() => pick(providers[0])}>Use QQ Mail</button></>}</span></div>

      <div className="prov-grid">
        {providers.map((q) => (
          <button key={q.id} className={`prov ${q.id === p.id ? 'on' : ''}`} onClick={() => pick(q)}>
            <span className="prov-logo" style={{ background: q.color }}>{q.letter || ''}</span>
            <span className="prov-name">{q.name}</span>
            {q.status === 'recommended' && <span className="chip-s ok">Recommended</span>}
            {q.status === 'limited' && <span className="chip-s warn">Limited</span>}
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>{p.blurb}</p>
      <button className="btn guide-btn" onClick={() => setGuide(true)}><BookOpen size={16} /> How to connect {p.name}</button>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <Field label="Your email address"><input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder={p.placeholder} autoComplete="off" /></Field>
        <Field label="Sender name" hint="Shown to the people you email."><input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={p.secretLabel} hint={acct.hasCode && sameProvider ? 'Saved. Leave blank to keep it.' : 'Not saved yet.'}><input type="password" autoComplete="new-password" value={f.secret} onChange={(e) => set('secret', e.target.value)} placeholder={acct.hasCode && sameProvider ? '••••••••••••' : ''} /></Field>
        <Field label="Reply-to (optional)" hint="Replies go to this address instead, e.g. your university mail."><input value={f.replyTo} onChange={(e) => set('replyTo', e.target.value)} placeholder="optional" /></Field>
        {p.editableUser && <Field label="Username (only if different from your email)"><input value={f.username} onChange={(e) => set('username', e.target.value)} /></Field>}
      </div>

      {p.editableServer ? (
        <div className="form-grid">
          <Field label="SMTP server"><input value={f.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.example.com" /></Field>
          <Field label="Port"><input type="number" value={f.port} onChange={(e) => set('port', e.target.value)} /></Field>
          <Field label="IMAP server (to read replies)" hint="Optional. Default: the SMTP name with imap."><input value={f.imapHost || ''} onChange={(e) => set('imapHost', e.target.value)} placeholder="imap.example.com" /></Field>
          <Field label="IMAP port"><input type="number" value={f.imapPort || ''} onChange={(e) => set('imapPort', e.target.value)} placeholder="993" /></Field>
          <Field label="Security"><select value={f.security} onChange={(e) => set('security', e.target.value)}><option value="ssl">SSL (port 465)</option><option value="starttls">STARTTLS (port 587)</option><option value="none">None (not recommended)</option></select></Field>
        </div>
      ) : <p className="srv-line">Server: <code>{p.host}:{p.port}</code> · {p.security === 'ssl' ? 'SSL' : 'STARTTLS'} (set automatically)</p>}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={save}>Save account</button>
        <button className="btn" onClick={test} disabled={checking}>{checking ? <><Loader2 size={16} className="spin" /> Checking…</> : 'Test connection'}</button>
      </div>
      {check && <div className={`banner ${check.ok ? 'ok' : 'err'}`}>{check.ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}<span>{check.message}</span></div>}
      {guide && <GuideModal p={p} onClose={() => setGuide(false)} />}
    </section>
  );
}
