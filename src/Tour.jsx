import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './ui.jsx';
import { Rocket, PlugZap, Paperclip, FileUp, Tags, CalendarClock, Radio, MessagesSquare, FileText, HardDrive, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const Box = ({ c, children, style }) => <div className="tv-box" style={{ '--c': c, ...style }}>{children}</div>;
const Pill = ({ c, children }) => <span className="tv-pill" style={{ '--c': c }}>{children}</span>;

const V = {
  flow: () => <div className="tv-flow">{[['Excel list', '#22c55e'], ['Review', '#6c7bff'], ['Schedule', '#f59e0b'], ['Replies', '#ec4899']].map(([t, c], i) => <><Box key={t} c={c}>{t}</Box>{i < 3 && <span className="tv-arrow">→</span>}</>)}</div>,
  provider: () => <div className="tv-tiles">{[['Q', 'QQ Mail', '#12b7f5', '★'], ['G', 'Gmail', '#ea4335'], ['163', '163', '#d6332b'], ['Y', 'Yahoo', '#6001d2'], ['iC', 'iCloud', '#4b4b50'], ['⚙', 'Custom', '#6b7280']].map(([l, n, c, s]) => <div key={n} className="tv-tile"><span style={{ background: c }}>{l}</span>{n}{s && <i>{s}</i>}</div>)}</div>,
  docs: () => <div className="tv-row">{['My_CV.pdf', 'Transcript.pdf'].map((n, i) => <div key={n} className="tv-doc"><b style={{ background: i ? '#6c7bff' : '#ef4444' }}>PDF</b>{n}<small>attached to every email</small></div>)}</div>,
  sheet: () => <div className="tv-sheet"><div className="tv-th"><span>Name</span><span>Email</span><span>Draft</span></div>{[1, 2, 3].map((i) => <div key={i}><span>Prof. {i}</span><span>prof{i}@uni.edu</span><span>Dear Prof…</span></div>)}<div className="tv-map"><Pill c="#22c55e">Email ✓</Pill><Pill c="#6c7bff">Name ✓</Pill><Pill c="#f59e0b">Draft ✓</Pill></div></div>,
  review: () => <div className="tv-list">{[['Prof. Li', 'Interested', '#22c55e', 'draft'], ['Prof. Wang', 'Waiting', '#f59e0b', 'draft'], ['Prof. Chen', 'Important', '#ec4899', 'draft']].map(([n, t, c, s]) => <div key={n}><b>{n}</b><Pill c={c}>{t}</Pill><span className="tv-st">{s}</span></div>)}</div>,
  schedule: () => <div className="tv-time"><div className="tv-axis"><span>8:00</span><span>8:30</span><span>9:00</span></div><div className="tv-track">{[6, 14, 22, 31, 38, 47, 55, 63, 72, 80, 88].map((x, i) => <i key={i} style={{ left: x + '%', background: ['#6c7bff', '#22c55e', '#f59e0b', '#ec4899'][i % 4] }} />)}</div><small>40 emails spread at random moments between 8:00 and 9:00</small></div>,
  running: () => <div className="tv-row"><div className="tv-tray">🖥️<small>closing the window keeps it running in the tray</small></div><div className="tv-states">{[['sent', '#22c55e'], ['sending', '#f59e0b'], ['scheduled', '#6c7bff']].map(([t, c]) => <Pill key={t} c={c}>{t}</Pill>)}<small>statuses update live</small></div></div>,
  replies: () => <div className="tv-chat"><div className="out">Dear Professor, may I ask…</div><div className="in">Yes, please come on Monday.</div><div className="out due">⏰ No reply for 7 days → create a follow-up</div></div>,
  resume: () => <div className="tv-resume"><div className="tv-page"><i className="ph" /><b /><s /><s /><s className="short" /><b /><s /><s /></div><div className="tv-side"><Pill c="#6c7bff">6 + 4 photo templates</Pill><Pill c="#22c55e">auto-save</Pill><Pill c="#f59e0b">PDF</Pill></div></div>,
  folders: () => <div className="tv-row">{[['📁 Data folder', 'emails, documents, Resume/'], ['💾 Backup folder', 'daily automatic copies']].map(([t, d]) => <div key={t} className="tv-doc"><b style={{ background: 'transparent', fontSize: 22 }}>{t.split(' ')[0]}</b>{t.slice(3)}<small>{d}</small></div>)}</div>,
};

const STEPS = [
  { icon: Rocket, c: ['#6c7bff', '#a855f7'], title: 'Welcome to Outreach Mailer', v: 'flow', to: null, pts: ['Import a list from Excel and review every email.', 'Send now or schedule at random times, from your own mailbox.', 'Follow replies, tag people, send follow-ups, and build your resume in the same app.'] },
  { icon: PlugZap, c: ['#12b7f5', '#0ea5e9'], title: '1 · Connect your email', v: 'provider', to: '/settings', cta: 'Open Settings', pts: ['Pick QQ Mail, Gmail, 163, Yahoo, iCloud, Zoho or any SMTP server.', 'Press “How to connect …” for the exact steps. You need an authorization code or app password, not your normal password.', 'In China, QQ Mail is the simplest and most reliable choice (no VPN needed).'] },
  { icon: Paperclip, c: ['#ef4444', '#f97316'], title: '2 · Upload your documents', v: 'docs', to: '/documents', cta: 'Open Documents', pts: ['Upload your CV and transcript once.', 'Tick them when you import: they are attached to every email automatically.'] },
  { icon: FileUp, c: ['#22c55e', '#14b8a6'], title: '3 · Import your list', v: 'sheet', to: '/import', cta: 'Open Import', pts: ['Drop an Excel/CSV file and map the columns: email, name, subject, body.', 'Use ready drafts from a column, or a template with {{placeholders}}.', 'Preview, then import. Each row becomes an editable email.'] },
  { icon: Tags, c: ['#ec4899', '#f43f5e'], title: '4 · Review, edit and tag', v: 'review', to: '/emails', cta: 'Open Emails', pts: ['Click any email to edit it, or send a test to yourself.', 'Add tags such as Interested / Waiting and filter by them.', 'Counts update as you filter: “Showing 12 of 40”.'] },
  { icon: CalendarClock, c: ['#f59e0b', '#ef4444'], title: '5 · Send or schedule', v: 'schedule', to: '/emails', cta: 'Open Emails', pts: ['Select emails → Schedule: send now, at a time, or random times in a date range.', 'Set a daily window (e.g. 8–9 am), skip weekends, keep a gap between emails.', 'Preview the plan and re-roll before you confirm.'] },
  { icon: Radio, c: ['#6c7bff', '#0ea5e9'], title: '6 · While it runs', v: 'running', to: null, pts: ['Closing the window keeps the app in the tray. Statuses change live.', 'If the PC was off: emails still inside their time window are sent right away.', 'If their whole window passed, you are asked once for all of them: send now, pick a new time, or keep as drafts.'] },
  { icon: MessagesSquare, c: ['#a855f7', '#ec4899'], title: '7 · Replies and follow-ups', v: 'replies', to: '/emails', cta: 'Open Emails', pts: ['“Check replies” reads your mailbox (IMAP) and shows answers as a conversation.', 'Reply right inside the app.', 'No answer after 7 days? A “Follow up” badge appears. Create follow-up drafts in one click.'] },
  { icon: FileText, c: ['#14b8a6', '#22c55e'], title: '8 · Resume maker', v: 'resume', to: '/resumes', cta: 'Open Resumes', pts: ['10 templates, including photo and personal-details layouts.', 'Select words in design mode to style only those words. Contact icons and spacing are adjustable.', 'Everything auto-saves into your Resume folder.'] },
  { icon: HardDrive, c: ['#64748b', '#334155'], title: '9 · Your folders and backups', v: 'folders', to: '/settings', cta: 'Open Settings', pts: ['Choose where your data lives and set a backup folder.', 'Backups run daily and include emails, documents, settings and all resumes.', 'Reopen this guide any time with “How it works” on the Dashboard.'] },
];

export default function Tour({ onClose }) {
  const [i, setI] = useState(0), nav = useNavigate(), s = STEPS[i], Icon = s.icon, Visual = V[s.v];
  const close = () => { try { localStorage.setItem('om_tour', '1'); } catch { /* ignore */ } onClose(); };
  const go = () => { close(); nav(s.to); };
  return (
    <Modal title="How it works" onClose={close} wide footer={<>
      <button className="btn" onClick={close}>Skip</button>
      <span style={{ flex: 1 }} />
      <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={16} /> Back</button>
      {s.to && <button className="btn" onClick={go}>{s.cta} <ArrowRight size={14} /></button>}
      {i < STEPS.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)}>Next <ChevronRight size={16} /></button> : <button className="btn primary" onClick={close}>Got it</button>}
    </>}>
      <div className="tour-hero" style={{ background: `linear-gradient(135deg, ${s.c[0]}, ${s.c[1]})` }}><Icon size={30} /><h2>{s.title}</h2></div>
      <div className="tour-visual"><Visual /></div>
      <ul className="tour-pts">{s.pts.map((p) => <li key={p}>{p}</li>)}</ul>
      <div className="tour-dots">{STEPS.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} />)}</div>
    </Modal>
  );
}
