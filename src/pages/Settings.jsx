import { useEffect, useState } from 'react';
import { FolderOpen, HardDriveDownload, History } from 'lucide-react';
import { api } from '../api.js';
import { Field, Toggle, useLoad, useToast } from '../ui.jsx';
import Credit from '../Credit.jsx';
import EmailAccount from './EmailAccount.jsx';
import { ThemeSwitch } from '../theme.jsx';

function StoragePanel() {
  const [i, setI] = useState(null), toast = useToast(), d = window.desktop;
  const load = () => d.info().then(setI);
  useEffect(() => { load(); }, []); // eslint-disable-line
  const act = (fn, ok) => async () => { try { const r = await fn(); if (ok && r !== null) toast(ok); await load(); } catch (e) { toast(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err'); } };
  if (!i) return null;
  const when = i.lastBackup ? new Date(i.lastBackup).toLocaleString() : 'never';
  return (
    <section className="card pad">
      <h3>Storage &amp; backup</h3>
      <span className="lbl">Data folder (emails, documents, settings and the Resume folder)</span>
      <div className="path-row"><code title={i.dataDir}>{i.dataDir}</code></div>
      <div className="btn-row">
        <button className="btn" onClick={act(d.chooseDataDir)}><FolderOpen size={16} /> Change folder…</button>
        <button className="btn" onClick={act(d.openDataDir)}>Open</button>
        <button className="btn" onClick={act(d.openResumeDir)}>Open Resume folder</button>
      </div>
      <p className="hint">Tip: pick a folder inside OneDrive or another synced folder to get an automatic off-site copy.</p>
      <span className="lbl" style={{ marginTop: 14 }}>Backup folder</span>
      <div className="path-row"><code title={i.backupDir}>{i.backupDir || 'Not chosen yet'}</code></div>
      <div className="btn-row">
        <button className="btn" onClick={act(d.chooseBackupDir, 'Backup folder saved')}><FolderOpen size={16} /> Choose…</button>
        <button className="btn primary" disabled={!i.backupDir} onClick={act(d.backupNow, 'Backup saved')}><HardDriveDownload size={16} /> Back up now</button>
        <button className="btn" onClick={act(d.restore)}><History size={16} /> Restore…</button>
        {i.backupDir && <button className="btn" onClick={act(d.openBackupDir)}>Open</button>}
      </div>
      <p className="hint">Last backup: {when}. With a backup folder set, the app also backs up automatically about once a day and keeps the newest 30 copies. The install folder is chosen when you run the installer.</p>
    </section>
  );
}

const ZONES = ['Asia/Shanghai', 'Asia/Dhaka', 'Asia/Tokyo', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];

export default function Settings() {
  const [s, reload] = useLoad(() => api.get('/api/settings'));
  const [form, setForm] = useState(null);
  const toast = useToast();
  useEffect(() => { if (s) setForm(s); }, [s]);
  if (!form) return <div className="page"><div className="spinner" /></div>;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => { try { await api.put('/api/settings', form); toast('Settings saved'); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>Settings</h1><p className="muted">Connect your mailbox, then tune how emails are sent.</p></div></header>
      <EmailAccount />
      <section className="card pad">
        <h3>Sending</h3>
        <Toggle checked={form.paused} onChange={(v) => set('paused', v)} label="Pause all sending" />
        <Toggle checked={form.checkReplies !== false} onChange={(v) => set('checkReplies', v)} label="Look for replies in my mailbox every 10 minutes (needs IMAP)" />
        <div className="form-grid">
          <Field label="Daily send cap" hint="0 = no limit. Counts emails actually sent per day."><input type="number" min="0" value={form.dailyCap} onChange={(e) => set('dailyCap', e.target.value)} /></Field>
          <Field label="Time zone" hint="Used for schedules and the daily cap."><select value={form.tz} onChange={(e) => set('tz', e.target.value)}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="Min pause between emails (sec)"><input type="number" min="5" value={form.gapMin} onChange={(e) => set('gapMin', e.target.value)} /></Field>
          <Field label="Max pause between emails (sec)"><input type="number" min="5" value={form.gapMax} onChange={(e) => set('gapMax', e.target.value)} /></Field>
          <Field label="Grace after a planned time (min)" hint="For 'send now' and 'specific time' schedules: how long after the planned time the app may still send. After that the email is held for your decision."><input type="number" min="5" value={form.missedGraceMin ?? 60} onChange={(e) => set('missedGraceMin', e.target.value)} /></Field>
          <Field label="Follow-up reminder after (days)" hint="Sent emails without a reply are marked “Follow up” after this many days."><input type="number" min="1" max="90" value={form.followUpDays ?? 7} onChange={(e) => set('followUpDays', e.target.value)} /></Field>
        </div>
        <button className="btn primary" onClick={save}>Save settings</button>
      </section>
      <section className="card pad"><h3>Appearance</h3><p className="muted">Dark is the default. The resume editor follows the same choice.</p><ThemeSwitch labels /></section>
      {window.desktop && <StoragePanel />}
      <section className="card pad about"><h3>About</h3><p className="muted">Outreach Mailer + Resume maker, a free desktop tool for sending outreach emails and building resumes.</p><Credit compact /></section>
    </div>
  );
}
