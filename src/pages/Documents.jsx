import { useRef, useState } from 'react';
import { UploadCloud, FileText, Trash2, Download } from 'lucide-react';
import { api } from '../api.js';
import { Empty, fmtSize, useLoad, useToast } from '../ui.jsx';

export default function Documents() {
  const [docs, reload] = useLoad(() => api.get('/api/documents'));
  const [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
  const input = useRef(); const toast = useToast();
  const upload = async (files) => {
    setBusy(true);
    try {
      for (const f of files) {
        if (f.size > 10e6) { toast(`${f.name} is larger than 10 MB`, 'err'); continue; }
        await api.put(`/api/documents?name=${encodeURIComponent(f.name)}`, f, { 'x-file-type': f.type || 'application/octet-stream' });
      }
      toast('Uploaded'); reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async (d) => {
    if (!confirm(`Delete ${d.name}? It will also be removed from any emails that use it.`)) return;
    const r = await api.del(`/api/documents/${d.id}`); toast(`Deleted${r.detached ? ` (detached from ${r.detached} emails)` : ''}`); reload();
  };
  return (
    <div className="page">
      <header className="page-head"><div><h1>Documents</h1><p className="muted">Upload your CV, transcript and other files once, then attach them to any batch.</p></div></header>
      <div className={`drop ${drag ? 'over' : ''}`} onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]); }}>
        <UploadCloud size={28} /><strong>{busy ? 'Uploading…' : 'Drop files here or click to upload'}</strong><span className="muted small">PDF, images or Word files up to 10 MB each</span>
        <input ref={input} type="file" multiple hidden onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
      </div>
      <section className="card">
        {!docs ? <div className="spinner" /> : docs.length === 0 ? <Empty icon={<FileText size={28} />} title="No documents yet">Upload your CV and transcript to attach them to emails.</Empty> :
          <ul className="list">{docs.map((d) => (
            <li key={d.id}>
              <div className="doc"><FileText size={20} /><div><strong>{d.name}</strong><div className="muted small">{fmtSize(d.size)}</div></div></div>
              <div className="row-actions">
                <a className="icon-btn" href={`/api/documents/${d.id}/download`} title="Download"><Download size={17} /></a>
                <button className="icon-btn danger" onClick={() => remove(d)} title="Delete"><Trash2 size={17} /></button>
              </div>
            </li>
          ))}</ul>}
      </section>
    </div>
  );
}
