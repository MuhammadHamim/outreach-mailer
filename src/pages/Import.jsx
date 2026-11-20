import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { api } from '../api.js';
import { Field, useLoad, useToast } from '../ui.jsx';

const guess = (headers, re) => headers.find((h) => re.test(h)) || '';
const NONE = '';

export default function ImportPage() {
  const [docs] = useLoad(() => api.get('/api/documents'));
  const [wb, setWb] = useState(null), [fileName, setFileName] = useState(''), [sheet, setSheet] = useState('');
  const [step, setStep] = useState(1), [busy, setBusy] = useState(false);
  const [m, setM] = useState({ email: '', name: '', body: '', subject: '', status: '' });
  const [subjectMode, setSubjectMode] = useState('fixed'), [fixedSubject, setFixedSubject] = useState("Request for Bachelor's Thesis Supervision");
  const [bodyMode, setBodyMode] = useState('column'), [template, setTemplate] = useState('Dear Professor {{Name}},\n\n...\n\nBest regards,\nMuhammad Hamim');
  const [batchName, setBatchName] = useState(''), [attach, setAttach] = useState(new Set());
  const input = useRef(); const nav = useNavigate(); const toast = useToast();

  const rows = useMemo(() => {
    if (!wb || !sheet) return { headers: [], data: [] };
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: false });
    const seen = {};
    const headers = (aoa[0] || []).map((h, i) => { let k = String(h).trim() || `Column ${i + 1}`; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? `${k} (${seen[k]})` : k; });
    const data = aoa.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '')])));
    return { headers, data };
  }, [wb, sheet]);

  const load = async (file) => {
    if (!file) return;
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setWb(book); setFileName(file.name); setSheet(book.SheetNames[0]);
      setBatchName(file.name.replace(/\.[^.]+$/, '')); setStep(2);
    } catch { toast('Could not read that file', 'err'); }
  };
  const pickSheet = (name) => {
    setSheet(name);
  };
  // auto-guess mapping whenever headers change
  const hs = rows.headers;
  useEffect(() => {
    if (!hs.length) return;
    setM({ email: guess(hs, /e-?mail|邮箱|邮件/i), name: guess(hs, /teacher|name|姓名/i), body: guess(hs, /draft|body|content|正文/i), subject: guess(hs, /subject|主题/i), status: guess(hs, /status/i) });
    if (hs.some((h) => /subject/i.test(h))) setSubjectMode('column');
  }, [hs.join('|')]); // eslint-disable-line

  const build = () => rows.data.map((r) => {
    let body = bodyMode === 'column' ? (r[m.body] || '') : template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k) => r[k] ?? '');
    let subject = subjectMode === 'column' ? (r[m.subject] || '') : fixedSubject;
    const first = body.split('\n')[0];
    if (/^subject:/i.test(first.trim())) { if (subjectMode === 'draft') subject = first.replace(/^subject:/i, '').trim(); body = body.split('\n').slice(1).join('\n').replace(/^\n+/, ''); }
    const status = m.status ? String(r[m.status] || '').toLowerCase() : '';
    return { to: (r[m.email] || '').trim(), toName: r[m.name] || '', subject, body, skip: /^(sent|replied)/.test(status) };
  });
  const all = useMemo(() => (step >= 3 ? build() : []), [step, rows, m, subjectMode, fixedSubject, bodyMode, template]); // eslint-disable-line
  const valid = all.filter((e) => !e.skip && /^\S+@\S+\.\S+$/.test(e.to) && e.subject && e.body.trim());

  const canNext = m.email && (bodyMode === 'template' || m.body) && (subjectMode !== 'column' || m.subject) && (subjectMode !== 'fixed' || fixedSubject.trim());
  const create = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/batches', { name: batchName, attachments: [...attach], emails: valid });
      toast(`Imported ${r.created} emails`); nav('/emails');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const Select = ({ value, onChange, optional }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>{optional && <option value={NONE}>- none -</option>}{!optional && !value && <option value="">Select column…</option>}{hs.map((h) => <option key={h}>{h}</option>)}</select>
  );
  return (
    <div className="page">
      <header className="page-head"><div><h1>Import</h1><p className="muted">Turn an Excel/CSV sheet into a batch of draft emails.</p></div></header>
      <ol className="steps">{['Upload', 'Map columns', 'Review'].map((s, i) => <li key={s} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}><span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>{s}</li>)}</ol>

      {step === 1 && (
        <div className="drop" onClick={() => input.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
          <FileSpreadsheet size={30} /><strong>Drop your Excel or CSV file here</strong><span className="muted small">.xlsx, .xls or .csv · first row = column headers</span>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => load(e.target.files[0])} />
        </div>
      )}

      {step === 2 && (
        <section className="card pad">
          <p className="muted"><strong>{fileName}</strong> · {rows.data.length} rows found</p>
          <div className="form-grid">
            {wb.SheetNames.length > 1 && <Field label="Sheet"><select value={sheet} onChange={(e) => pickSheet(e.target.value)}>{wb.SheetNames.map((s) => <option key={s}>{s}</option>)}</select></Field>}
            <Field label="Batch name" hint="E.g. the university name."><input value={batchName} onChange={(e) => setBatchName(e.target.value)} /></Field>
            <Field label="Email address column *"><Select value={m.email} onChange={(v) => setM({ ...m, email: v })} /></Field>
            <Field label="Teacher name column"><Select optional value={m.name} onChange={(v) => setM({ ...m, name: v })} /></Field>
            <Field label="Skip rows already sent (status column)"><Select optional value={m.status} onChange={(v) => setM({ ...m, status: v })} /></Field>
          </div>
          <h4>Subject</h4>
          <div className="seg">{[['fixed', 'Same for all'], ['column', 'From a column'], ['draft', 'From “Subject:” line in draft']].map(([k, l]) => <button key={k} className={subjectMode === k ? 'on' : ''} onClick={() => setSubjectMode(k)}>{l}</button>)}</div>
          {subjectMode === 'fixed' && <input value={fixedSubject} onChange={(e) => setFixedSubject(e.target.value)} />}
          {subjectMode === 'column' && <Select value={m.subject} onChange={(v) => setM({ ...m, subject: v })} />}
          <h4>Email body</h4>
          <div className="seg">{[['column', 'From a column (ready-made drafts)'], ['template', 'Template with {{placeholders}}']].map(([k, l]) => <button key={k} className={bodyMode === k ? 'on' : ''} onClick={() => setBodyMode(k)}>{l}</button>)}</div>
          {bodyMode === 'column' ? <Select value={m.body} onChange={(v) => setM({ ...m, body: v })} /> : (
            <>
              <textarea rows={8} value={template} onChange={(e) => setTemplate(e.target.value)} />
              <p className="hint">Use column names in double braces, e.g. {hs.slice(0, 3).map((h) => `{{${h}}}`).join(', ')}</p>
            </>
          )}
          <h4>Attachments</h4>
          {!docs?.length ? <p className="muted small">No documents uploaded yet - add your CV and transcript on the Documents page. You can also attach them later.</p> :
            <div className="chips">{docs.map((d) => <label key={d.id} className={`chip ${attach.has(d.id) ? 'on' : ''}`}><input type="checkbox" hidden checked={attach.has(d.id)} onChange={() => setAttach((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })} />{d.name}</label>)}</div>}
          <div className="actions"><button className="btn" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button><button className="btn primary" disabled={!canNext || !batchName.trim()} onClick={() => setStep(3)}>Preview <ArrowRight size={16} /></button></div>
        </section>
      )}

      {step === 3 && (
        <section className="card pad">
          <p><strong>{valid.length}</strong> emails ready{all.length - valid.length > 0 && <span className="muted"> · {all.length - valid.length} skipped (missing/invalid email, subject or body, or already sent)</span>}</p>
          {valid.slice(0, 3).map((e, i) => (
            <div className="preview" key={i}><div className="small muted">To: {e.toName ? `${e.toName} ` : ''}&lt;{e.to}&gt;</div><div><strong>{e.subject}</strong></div><pre>{e.body}</pre></div>
          ))}
          {valid.length > 3 && <p className="muted small">…and {valid.length - 3} more. You can review and edit every email on the next screen.</p>}
          <div className="actions"><button className="btn" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button><button className="btn primary" disabled={busy || !valid.length} onClick={create}>{busy ? 'Importing…' : `Import ${valid.length} emails`}</button></div>
        </section>
      )}
    </div>
  );
}
