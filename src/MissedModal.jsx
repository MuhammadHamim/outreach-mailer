import { useEffect, useState } from 'react';
import { CalendarClock, Send, FileText } from 'lucide-react';
import { api } from './api.js';
import { Modal, fmtTime, useToast } from './ui.jsx';
import { ScheduleModal } from './pages/Emails.jsx';

// Asked ONCE for all emails whose planned time window passed while the app (or the computer) was off.
export default function MissedModal() {
  const [m, setM] = useState(null), [schedule, setSchedule] = useState(false), [later, setLater] = useState(() => sessionStorage.getItem('om_missed_later') === '1');
  const toast = useToast();
  const check = () => api.get('/api/missed').then(setM).catch(() => {});
  useEffect(() => { check(); const t = setInterval(check, 15000); return () => clearInterval(t); }, []);
  if (!m || !m.count || later) return null;
  const ids = m.groups.flatMap((g) => g.ids);
  const resolve = async (action) => { try { await api.post('/api/missed/resolve', { action }); toast(action === 'now' ? `Sending ${m.count} emails now` : 'Moved to drafts'); setM(null); check(); } catch (e) { toast(e.message, 'err'); } };
  if (schedule) return <ScheduleModal ids={ids} tz={m.tz} onClose={() => setSchedule(false)} onDone={(msg) => { toast(msg); setSchedule(false); setM(null); check(); }} />;
  return (
    <Modal title={`${m.count} email${m.count > 1 ? 's' : ''} missed their time`} onClose={() => { sessionStorage.setItem('om_missed_later', '1'); setLater(true); }} wide footer={<>
      <button className="btn" onClick={() => { sessionStorage.setItem('om_missed_later', '1'); setLater(true); }}>Decide later</button><span style={{ flex: 1 }} />
      <button className="btn" onClick={() => resolve('draft')}><FileText size={16} /> Keep as drafts</button>
      <button className="btn" onClick={() => setSchedule(true)}><CalendarClock size={16} /> Choose a new time…</button>
      <button className="btn primary" onClick={() => resolve('now')}><Send size={16} /> Send all now</button></>}>
      <div className="banner warn"><span>The app was closed or the computer was off while these were scheduled, and their time window is already over. Nothing was sent. What should happen with <b>all of them</b>?</span></div>
      <ul className="list">{m.groups.map((g, i) => <li key={i}><div><strong>{g.count} email{g.count > 1 ? 's' : ''} · {g.batch}</strong><div className="muted small">planned {fmtTime(g.from, m.tz)} – {fmtTime(g.until, m.tz, false)}</div></div></li>)}</ul>
      <p className="hint">Emails that were still inside their window when the app started were sent normally, without asking.</p>
    </Modal>
  );
}
