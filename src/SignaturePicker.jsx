import { useEffect, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { api } from './api';
import { useToast } from './ui';
import SignatureBuilder from './SignatureBuilder';
import './compose-extras.css';
const pack = (s) => ({ id: s.id, html: s.html, css: s.css });
export default function SignaturePicker({ sig, onChange }) {
  const toast = useToast(); const [list, setList] = useState([]), [creating, setCreating] = useState(false);
  const load = () => api.get('/api/signatures').then((l) => { setList(l); return l; });
  useEffect(() => { load().then((l) => { const d = l.find((s) => s.isDefault); if (d) onChange(pack(d)); }).catch(() => {}); }, []); // eslint-disable-line
  const current = list.find((s) => s.id === sig?.id);
  const makeDefault = async () => { try { await api.post(`/api/signatures/${sig.id}/default`); await load(); toast('Default signature updated'); } catch (e) { toast(e.message, 'err'); } };
  return <div className="sigbox"><h4>Signature</h4><div className="sig-head"><select value={sig?.id || ''} onChange={(e) => { const s = list.find((x) => x.id === e.target.value); onChange(s ? pack(s) : null); }} aria-label="Signature"><option value="">No signature</option>{list.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (default)' : ''}</option>)}</select>{current && !current.isDefault && <button type="button" className="btn" onClick={makeDefault}><Star size={14} /> Make default</button>}<button type="button" className="btn" onClick={() => setCreating(true)}><Plus size={14} /> New signature</button></div>{!creating && sig?.html && <div className="sig-preview" dangerouslySetInnerHTML={{ __html: sig.html }} />}{!creating && !list.length && <p className="muted small" style={{ marginTop: 6 }}>No signatures yet. Create one here or on the Signatures page.</p>}{creating && <SignatureBuilder onCancel={() => setCreating(false)} onSaved={async (saved) => { await load(); onChange(pack(saved)); setCreating(false); }} />}</div>;
}