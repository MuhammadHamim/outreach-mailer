import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, AlertTriangle, FileText, PauseCircle, PlayCircle, ArrowRight, MessageCircle, BellRing, GraduationCap, Check } from 'lucide-react';
import { api } from '../api.js';
import { useEffect, useState } from 'react';
import { useLoad, fmtTime, useToast } from '../ui.jsx';
import Tour from '../Tour.jsx';

export default function Dashboard() {
  const [d, reload, err] = useLoad(() => api.get('/api/overview'));
  const toast = useToast(), [tour, setTour] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem('om_tour')) setTour(true); } catch { /* ignore */ } }, []);
  if (err) return <div className="page"><div className="form-err">{err}</div></div>;
  if (!d) return <div className="page"><div className="spinner" /></div>;
  const c = d.counts, tz = d.settings.tz;
  const togglePause = async () => { await api.put('/api/settings', { paused: !d.settings.paused }); toast(d.settings.paused ? 'Sending resumed' : 'Sending paused'); reload(); };
  const steps = [
    { label: 'Connect your email', hint: 'Pick a provider and test it', to: '/settings', done: d.accountReady },
    { label: 'Upload CV & transcript', hint: 'Attached automatically', to: '/documents', done: d.docs > 0 },
    { label: 'Import your list', hint: 'Excel or CSV', to: '/import', done: d.total > 0 },
    { label: 'Schedule or send', hint: 'Now, or random times', to: '/emails', done: (c.scheduled || 0) + (c.sent || 0) + (c.replied || 0) > 0 },
  ];
  const cards = [
    ['Drafts', c.draft || 0, FileText, 'slate'], ['Scheduled', c.scheduled || 0, Clock, 'blue'],
    ['Sent', (c.sent || 0) + (c.replied || 0), CheckCircle2, 'green'], ['Failed', c.failed || 0, AlertTriangle, 'red'],
  ];
  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Dashboard</h1><p className="muted">{d.total} emails total · {d.todaySent} sent today{d.settings.dailyCap ? ` (cap ${d.settings.dailyCap})` : ''}</p></div>
        <div className="btn-row">
        <button className="btn" onClick={() => setTour(true)}><GraduationCap size={16} /> How it works</button>
        <button className={`btn ${d.settings.paused ? 'primary' : ''}`} onClick={togglePause}>
          {d.settings.paused ? <><PlayCircle size={16} /> Resume sending</> : <><PauseCircle size={16} /> Pause sending</>}
        </button>
        </div>
      </header>
      {steps.some((x) => !x.done) && (
        <section className="card pad checklist">
          <div className="row-between"><h3 style={{ margin: 0 }}>Getting started</h3><span className="muted small">{steps.filter((x) => x.done).length} of {steps.length} done</span></div>
          <div className="progress"><i style={{ width: `${(steps.filter((x) => x.done).length / steps.length) * 100}%` }} /></div>
          <div className="steps-grid">{steps.map((x, i) => <Link key={x.label} to={x.to} className={`stepcard ${x.done ? 'done' : ''}`}><span className="stepno">{x.done ? <Check size={14} /> : i + 1}</span><span><b>{x.label}</b><small>{x.hint}</small></span></Link>)}</div>
        </section>
      )}
      {d.settings.paused && <div className="banner warn">Sending is paused. Scheduled emails will wait until you resume.</div>}
      {d.storage === 'local' && (d.desktop
        ? <div className="banner info">Closing this window keeps Outreach Mailer running in the system tray, so scheduled emails still go out. Quit it from the tray icon (or shut down / sleep the computer) and sending stops.</div>
        : <div className="banner info">Running on this computer: scheduled emails go out only while this app is open and your computer is awake. Anything that misses its time is flagged so you can reschedule it.</div>)}
      {!d.sender && d.mailMode !== 'dry' && <div className="banner warn">Your email account isn't set up yet (in China, QQ Mail is the simplest choice). <Link to="/settings" className="link">Open Settings</Link></div>}
      {d.mailMode === 'dry' && <div className="banner info">Dry-run mode: emails are logged on the server, not actually sent.</div>}
      <section className="stats">
        {cards.map(([label, n, Icon, tone]) => (
          <div key={label} className={`stat ${tone}`}><span className="stat-ic"><Icon size={18} /></span><div><div className="stat-n">{n}</div><div className="stat-l">{label}</div></div></div>
        ))}
      </section>
      {(d.unreadReplies > 0 || d.followUpDue > 0 || c.missed > 0) && (
        <div className="alert-row">
          {d.unreadReplies > 0 && <Link to="/emails" className="alert green"><MessageCircle size={16} /> <b>{d.unreadReplies}</b> unread repl{d.unreadReplies > 1 ? 'ies' : 'y'}</Link>}
          {d.followUpDue > 0 && <Link to="/emails" className="alert amber"><BellRing size={16} /> <b>{d.followUpDue}</b> need a follow-up</Link>}
          {c.missed > 0 && <Link to="/emails" className="alert red"><AlertTriangle size={16} /> <b>{c.missed}</b> missed their time</Link>}
        </div>
      )}
      <div className="grid2">
        <section className="card">
          <div className="card-head"><h3>Up next</h3><Link to="/emails" className="link">All emails <ArrowRight size={14} /></Link></div>
          {d.upcoming.length === 0 ? <p className="muted pad">Nothing scheduled yet. Import a sheet, then schedule it from the Emails page.</p> :
            <ul className="list">{d.upcoming.map((u) => (
              <li key={u.id}><div><strong>{u.toName || u.to}</strong><div className="muted small">{u.to}</div></div><span className="pill">{fmtTime(u.sendAt, tz)}</span></li>
            ))}</ul>}
        </section>
        <section className="card">
          <div className="card-head"><h3>Recently sent</h3></div>
          {d.recent.length === 0 ? <p className="muted pad">No emails sent yet.</p> :
            <ul className="list">{d.recent.map((u) => (
              <li key={u.id}><div><strong>{u.toName || u.to}</strong><div className="muted small">{u.to}</div></div><span className="pill green">{fmtTime(u.sentAt, tz)}</span></li>
            ))}</ul>}
        </section>
      </div>
      {tour && <Tour onClose={() => setTour(false)} />}
    </div>
  );
}
