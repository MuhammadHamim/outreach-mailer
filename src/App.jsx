import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, FileUp, Mail, Paperclip, FileText, Settings as Cog, LogOut, Send } from 'lucide-react';
import { api } from './api.js';
import Credit from './Credit.jsx';
import { ThemeSwitch } from './theme.jsx';
import MissedModal from './MissedModal.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ImportPage from './pages/Import.jsx';
import Emails from './pages/Emails.jsx';
import Documents from './pages/Documents.jsx';
import Resumes from './pages/Resumes.jsx';
import SettingsPage from './pages/Settings.jsx';

const NAV = [
  ['/', 'Dashboard', LayoutDashboard], ['/import', 'Import', FileUp], ['/emails', 'Emails', Mail],
  ['/documents', 'Documents', Paperclip], ['/resumes', 'Resumes', FileText], ['/settings', 'Settings', Cog],
];

export default function App() {
  const [authed, setAuthed] = useState(null), [hasAuth, setHasAuth] = useState(true);
  useEffect(() => {
    api.get('/api/me').then((r) => { setHasAuth(r.auth); setAuthed(true); }).catch(() => setAuthed(false));
    const off = () => setAuthed(false);
    window.addEventListener('unauth', off); return () => window.removeEventListener('unauth', off);
  }, []);
  if (authed === null) return <div className="boot"><div className="spinner" /></div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const logout = async () => { await api.post('/api/logout'); setAuthed(false); };
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo"><Send size={16} /></span> Outreach Mailer</div>
        <nav>{NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className="nav-item"><Icon size={18} /><span>{label}</span></NavLink>
        ))}</nav>
        <ThemeSwitch />
        <Credit />
        {hasAuth && <button className="nav-item logout" onClick={logout}><LogOut size={18} /><span>Sign out</span></button>}
      </aside>
      <MissedModal />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/emails" element={<Emails />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
