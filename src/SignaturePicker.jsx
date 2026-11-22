import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { api } from './api';
import { Field, useToast } from './ui';
import { SIGNATURES, SAMPLE } from './signatureTemplates';
import './compose-extras.css';

const FIELDS = [
  ['name', 'Full name'], ['title', 'Job title'], ['company', 'Company / university'], ['phone', 'Phone'],
  ['email', 'Email'], ['website', 'Website'], ['linkedin', 'LinkedIn'], ['tagline', 'Tagline'],
  ['logoUrl', 'Logo image URL'], ['photoUrl', 'Photo image URL'], ['ctaText', 'Button text'], ['ctaUrl', 'Button link'],
];
const clean = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => String(v || '').trim()));
const tplOf = (id) => SIGNATURES.find((t) => t.id === id) || SIGNATURES[0];

// sig = { id, html } | null   ·   onChange(sig | null)
export default function SignaturePicker({ sig, onChange }) {
  const toast = useToast();
  const [list, setList] = useState([]), [ed, setEd] = useState(null), [busy, setBusy] = useState(false);
  const load = () => api.get('/api/signatures').then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const startNew = () => setEd({ id: null, name: '', templateId: SIGNATURES[0].id, fields: { accent: '#4f46e5' } });
  const startEdit = () => { const s = list.find((x) => x.id === sig?.id); if (s) setEd({ id: s.id, name: s.name, templateId: s.templateId, fields: s.fields || {} }); };
  const setField = (k, v) => setEd((e) => ({ ...e, fields: { ...e.fields, [k]: v } }));
  const real = ed ? { accent: '#4f46e5', ...clean(ed.fields) } : {};

  const save = async () => {
    if (!ed.name.trim()) return toast('Give this signature a name', 'err');
    if (!real.name) return toast('Enter your full name', 'err');
    setBusy(true);
    try {
      const html = tplOf(ed.templateId).build(real);
      const r = await api.post('/api/signatures', { id: ed.id, name: ed.name.trim(), templateId: ed.templateId, fields: ed.fields, html });
      await load(); onChange({ id: r.id, html: r.html }); setEd(null); toast('Signature saved');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm('Delete this signature?')) return;
    try { await api.del(`/api/signatures/${sig.id}`); onChange(null); load(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="sigbox">
      <h4>Signature</h4>
      <div className="sig-head">
        <select value={sig?.id || ''} onChange={(e) => { const s = list.find((x) => x.id === e.target.value); onChange(s ? { id: s.id, html: s.html } : null); }}>
          <option value="">No signature</option>
          {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={startNew}><Plus size={14} /> New signature</button>
        {sig?.id && <button type="button" className="btn" onClick={startEdit}><Pencil size={14} /> Edit</button>}
        {sig?.id && <button type="button" className="btn danger-o" onClick={remove}><Trash2 size={14} /> Delete</button>}
      </div>
      {!ed && sig?.html && <div className="sig-preview" dangerouslySetInnerHTML={{ __html: sig.html }} />}

      {ed && (
        <div className="sig-builder">
          <div className="form-grid">
            <Field label="Signature name * (e.g. Job applications)"><input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></Field>
            <Field label="Accent colour"><input type="color" value={ed.fields.accent || '#4f46e5'} onChange={(e) => setField('accent', e.target.value)} /></Field>
          </div>
          <div className="form-grid">
            {FIELDS.map(([k, l]) => <Field key={k} label={l}><input value={ed.fields[k] || ''} onChange={(e) => setField(k, e.target.value)} placeholder={SAMPLE[k] || ''} /></Field>)}
          </div>
          <div>
            <strong style={{ fontSize: 13 }}>Pick a design</strong>
            <div className="sig-gallery" style={{ marginTop: 6 }}>
              {SIGNATURES.map((t) => (
                <div key={t.id} role="button" tabIndex={0} className={`sig-tpl ${ed.templateId === t.id ? 'on' : ''}`}
                  onClick={() => setEd({ ...ed, templateId: t.id })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setEd({ ...ed, templateId: t.id })}>
                  <div className="sig-tpl-name">{t.name}<small>{t.purpose}</small></div>
                  <div className="sig-tpl-prev" dangerouslySetInnerHTML={{ __html: t.build({ ...SAMPLE, ...clean(ed.fields), accent: real.accent }) }} />
                </div>
              ))}
            </div>
          </div>
          {real.name && <div><strong style={{ fontSize: 13 }}>Your signature</strong><div className="sig-preview" dangerouslySetInnerHTML={{ __html: tplOf(ed.templateId).build(real) }} /></div>}
          <div className="sig-actions">
            <button type="button" className="btn primary" disabled={busy} onClick={save}><Save size={14} /> {ed.id ? 'Update signature' : 'Save signature'}</button>
            <button type="button" className="btn" onClick={() => setEd(null)}><X size={14} /> Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
