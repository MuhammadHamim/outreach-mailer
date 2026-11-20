import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Copy, Trash2, Pencil, FolderOpen, FileUp, Sparkles, FileText, LayoutTemplate, BookOpen, ClipboardCopy } from 'lucide-react';
import { Paper, TEMPLATES } from '../resume/render';
import { BLANK, SAMPLE, SAMPLE_PLAIN, JSON_REF, normalize, uid } from '../resume/core/data';
import { api } from '../api.js';
import { Empty, Field, Modal, fmtTime, useToast } from '../ui.jsx';

const DESC = {
  classic: 'Traditional serif layout with navy accents. Works in any industry.',
  modern: 'Clean sans-serif with teal accent bars. Great for tech and design.',
  compact: 'Dense, plain and ATS-safe. Fits more on a single page.',
  sidebar: 'Two-column layout with a dark sidebar for contact and skills.',
  elegant: 'Refined serif with centered header. Ideal for senior roles.',
  academic: 'Formal CV for Masters, PhD, research and faculty applications.',
  photoClassic: 'Classic layout with a photo and personal details (gender, age, nationality) in the header.',
  photoSidebar: 'Dark sidebar with a round photo, personal details and contacts. Great for applications that expect a photo.',
  photoBand: 'Bold colour band header with photo, name and contacts. Friendly and modern.',
  infoGrid: 'Chinese-style 中文简历: personal-info grid with a portrait photo on the right.',
};
const newId = () => { let s = ''; while (s.length < 8) s += uid(); return s.slice(0, 10); };
const openEditor = (id) => { location.href = `/resume-editor.html?id=${encodeURIComponent(id)}`; };

function Thumb({ data, tpl, w = 200 }) {
  return (
    <div className="thumb" style={{ width: w, height: Math.round(w * 1.414) }}>
      <div style={{ width: 794, transform: `scale(${w / 794})`, transformOrigin: 'top left', pointerEvents: 'none' }}><Paper d={data} tpl={tpl} first /></div>
    </div>
  );
}

export default function Resumes() {
  const [sp, setSp] = useSearchParams();
  const tab = ['templates', 'guide'].includes(sp.get('tab')) ? sp.get('tab') : 'mine';
  const [items, setItems] = useState(null), [dir, setDir] = useState(''), [q, setQ] = useState('');
  const [importing, setImporting] = useState(false), [del, setDel] = useState(null), [err, setErr] = useState('');
  const toast = useToast();

  const load = () => api.get('/api/resumes').then((r) => { setItems(r.items); setDir(r.dir); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const create = async (data, template = 'classic') => {
    try {
      const rec = { id: newId(), name: 'Untitled resume', template, data: structuredClone(data), updated: Date.now() };
      await api.put(`/api/resumes/${rec.id}`, rec);
      openEditor(rec.id);
    } catch (e) { toast(e.message, 'err'); }
  };
  const dup = async (r) => {
    const copy = { ...r, id: newId(), name: `${r.name} (copy)`, updated: Date.now() };
    try { await api.put(`/api/resumes/${copy.id}`, copy); toast('Resume copied'); load(); } catch (e) { toast(e.message, 'err'); }
  };
  const doDelete = async () => { try { await api.del(`/api/resumes/${del.id}`); toast('Resume deleted'); setDel(null); load(); } catch (e) { toast(e.message, 'err'); } };

  const shown = useMemo(() => (items || []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const setTab = (t) => setSp(t === 'mine' ? {} : { tab: t });
  const openFolder = () => window.desktop?.openResumeDir?.();

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Resumes</h1><p className="muted">Build, edit and download professional resumes. Everything autosaves to your Resume folder.</p></div>
        <div className="btn-row">
          <button className="btn" onClick={() => setImporting(true)}><FileUp size={16} /> Import JSON</button>
          <button className="btn" onClick={() => create(SAMPLE_PLAIN)}><Sparkles size={16} /> From sample</button>
          <button className="btn primary" onClick={() => create(BLANK)}><Plus size={16} /> New resume</button>
        </div>
      </header>

      <div className="status-tabs">
        {[['mine', 'My resumes', FileText], ['templates', 'Templates', LayoutTemplate], ['guide', 'Guide', BookOpen]].map(([k, l, Icon]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{l}{k === 'mine' && items ? <b>{items.length}</b> : null}</button>
        ))}
      </div>

      {err && <div className="form-err">{err}</div>}

      {tab === 'mine' && (
        <>
          <div className="toolbar"><div className="input-icon grow"><Search size={16} /><input placeholder="Search resumes" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          {items === null ? <div className="spinner" /> : shown.length === 0 ? (
            <section className="card"><Empty icon={<FileText size={28} />} title={items.length ? 'No matches' : 'No resumes yet'}>{items.length ? 'Try a different search.' : 'Create your first resume, start from the sample, or browse the templates.'}
              {!items.length && <div style={{ marginTop: 14 }}><button className="btn primary" onClick={() => setTab('templates')}>Browse templates</button></div>}</Empty></section>
          ) : (
            <div className="resume-grid">
              {shown.map((r) => (
                <div key={r.id} className="card rcard">
                  <button className="rthumb" onClick={() => openEditor(r.id)} aria-label={`Open ${r.name}`}><Thumb data={r.data} tpl={r.template} w={124} /></button>
                  <div className="rinfo">
                    <strong className="rname" title={r.name}>{r.name}</strong>
                    <span className="muted small">{TEMPLATES[r.template]?.name || r.template}</span>
                    <span className="muted small">Edited {fmtTime(r.updated, undefined, true)}</span>
                    <div className="btn-row rbtns">
                      <button className="btn primary small" onClick={() => openEditor(r.id)}><Pencil size={13} /> Edit</button>
                      <button className="btn small" onClick={() => dup(r)}><Copy size={13} /> Copy</button>
                      <button className="btn small danger-o" onClick={() => setDel(r)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pathbar">
            <span className="muted small">Saved automatically in</span>
            <code title={dir}>{dir || '…'}</code>
            {window.desktop?.openResumeDir && <button className="btn small" onClick={openFolder}><FolderOpen size={14} /> Open folder</button>}
          </div>
        </>
      )}

      {tab === 'templates' && (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>Every format is ATS-friendly and prints on A4. You can switch templates any time inside the editor.</p>
          <div className="tpl-grid">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <div key={k} className="card tcard">
                <Thumb data={SAMPLE_PLAIN} tpl={k} w={230} />
                <div className="tinfo"><strong>{t.name}</strong><p className="muted small">{DESC[k]}</p></div>
                <div className="btn-row" style={{ justifyContent: 'center' }}>
                  <button className="btn primary small" onClick={() => create(SAMPLE_PLAIN, k)}>Use with sample</button>
                  <button className="btn small" onClick={() => create(BLANK, k)}>Start blank</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'guide' && <Guide dir={dir} />}

      {importing && <ImportModal onClose={() => setImporting(false)} onApply={(d) => create(d, d.template && TEMPLATES[d.template] ? d.template : 'classic')} />}
      {del && (
        <Modal title="Delete resume?" onClose={() => setDel(null)} footer={<><button className="btn" onClick={() => setDel(null)}>Cancel</button><button className="btn primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={doDelete}>Delete</button></>}>
          <p>“{del.name}” will be removed from your Resume folder. This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}

function ImportModal({ onClose, onApply }) {
  const [txt, setTxt] = useState(''), [err, setErr] = useState('');
  const toast = useToast();
  const copy = (s, m) => navigator.clipboard.writeText(s).then(() => toast(m));
  const go = () => { try { onApply(normalize(JSON.parse(txt))); } catch (e) { setErr(e.message); } };
  return (
    <Modal title="Import resume JSON" onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!txt.trim()} onClick={go}>Create resume from JSON</button></>}>
      <p className="muted">Paste the JSON of a resume (for example one produced by an AI assistant from your old CV). A new resume is created and opened in the editor.</p>
      <div className="btn-row" style={{ margin: '10px 0' }}>
        <button className="btn small" onClick={() => copy(JSON.stringify(SAMPLE, null, 2), 'Sample format copied')}><ClipboardCopy size={14} /> Copy sample format</button>
      </div>
      <Field label="Resume JSON"><textarea rows={14} className="mono" placeholder="Paste JSON here" value={txt} onChange={(e) => { setTxt(e.target.value); setErr(''); }} /></Field>
      {err && <div className="form-err">{err}</div>}
    </Modal>
  );
}

function Guide({ dir }) {
  const toast = useToast();
  const json = JSON.stringify(SAMPLE, null, 2);
  const prompt = `Convert my resume below into JSON that exactly matches this format. Use **bold** and [text](url) markdown inside strings where useful. Return only JSON.\n\nFORMAT:\n${json}\n\nMY RESUME:\n`;
  const copy = (s, m) => navigator.clipboard.writeText(s).then(() => toast(m));
  const faq = [
    ['How do I download a PDF?', 'Open a resume and click Download PDF. In the desktop app a Save dialog opens and a real, text-based (ATS-friendly) PDF is written where you choose, by default into Resume/PDF. In a browser, choose "Save as PDF" in the print dialog and turn off "Headers and footers". "PDF file" saves a picture-based PDF directly.'],
    ['What do "blocks" mean in the JSON?', 'Each section holds one or more "blocks", and a block\'s "type" can be text (paragraph), entries (items with dates and bullets), skills (label: items), bullets (simple list) or tags (chips). Mix as many blocks as you like in one section. Add "pageBreak": true to start a section on a new page and "flow": "split" to let it continue across pages. An optional top-level "style" sets size, font, accent, lineHeight, margin and gap.'],
    ['Can I add sections like Publications?', 'Yes. Use "+ Entries section" in the editor, or add another object to "sections" in the JSON.'],
    ['Where are my resumes stored?', `As one JSON file per resume in the Resume folder inside your data folder${dir ? ` (${dir})` : ''}. Every change is saved automatically. Change the data folder or set up backups in Settings → Storage & backup.`],
  ];
  return (
    <>
      <div className="guide-steps">
        {[['1. Create', 'Start blank, from a sample or from a template.'], ['2. Fill & preview', 'Type in the form. The A4 preview updates live. Use Design mode to move things around like in Figma.'], ['3. Download', 'Hit Download PDF and save your resume.']].map(([t, d]) => (
          <div key={t} className="card pad"><strong className="accent">{t}</strong><p className="muted">{d}</p></div>
        ))}
      </div>
      <section className="card pad">
        <h3>Text formatting</h3>
        <table className="ftable"><tbody>
          {[['**bold text**', 'bold text'], ['[Portfolio](https://example.com)', 'clickable link'], ['One line = one bullet', 'in any "Bullets" box']].map(([a, b]) => <tr key={a}><td><code>{a}</code></td><td className="muted">{b}</td></tr>)}
        </tbody></table>
      </section>
      <section className="card pad">
        <div className="row-between"><h3 style={{ margin: 0 }}>JSON format</h3><div className="btn-row"><button className="btn small" onClick={() => copy(json, 'Format copied')}>Copy format</button><button className="btn primary small" onClick={() => copy(prompt, 'AI prompt copied')}>Copy AI prompt</button></div></div>
        <p className="muted">Paste the AI prompt into any assistant together with your old resume, then paste the JSON it returns using “Import JSON” or the editor's JSON button.</p>
        <pre className="codebox">{json}</pre>
        <h4>Field reference: every style option</h4>
        <div className="ref-list">{JSON_REF.map(([k, v]) => <div key={k}><code>{k}</code><span className="muted">{v}</span></div>)}</div>
      </section>
      <section className="card faq">{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}</section>
    </>
  );
}
