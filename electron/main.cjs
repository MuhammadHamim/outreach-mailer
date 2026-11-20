// Desktop shell: starts the local server inside Electron, shows the UI in a window,
// keeps running in the system tray so scheduled emails still go out.
const { app, BrowserWindow, Tray, Menu, nativeImage, powerSaveBlocker, shell, dialog, Notification, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { pathToFileURL } = require('node:url');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null, tray = null, port = 0, quitting = false, blocker = null, scheduled = 0, told = false, unread = null;
const icon = (f) => path.join(__dirname, '..', 'build', f);
const appIcon = () => nativeImage.createFromPath(icon(process.platform === 'win32' ? 'icon.ico' : 'icon.png'));
if (process.platform === 'win32') app.setAppUserModelId('com.hamim.outreachmailer'); // same as the installer's appId: correct taskbar icon, grouping and notification icon
const base = () => `http://127.0.0.1:${port}`;

// ---------- settings that must be known before the server starts ----------
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch { return {}; } };
const writeCfg = (patch) => { const c = { ...readCfg(), ...patch }; fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2)); return c; };
const defaultDataDir = () => path.join(app.getPath('userData'), 'data');
const dataDir = () => readCfg().dataDir || defaultDataDir();
const dbFile = () => path.join(dataDir(), 'db.json');
const resumeDir = () => path.join(dataDir(), 'Resume');
const safeFile = (n) => (String(n || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)) || 'resume';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function applyPendingRestore() {
  const { pendingRestore } = readCfg();
  if (!pendingRestore) return;
  try {
    const ts = Date.now();
    fs.mkdirSync(dataDir(), { recursive: true });
    const j = JSON.parse(fs.readFileSync(pendingRestore, 'utf8'));
    const resumes = j.__resumes; delete j.__resumes;
    if (fs.existsSync(dbFile())) fs.copyFileSync(dbFile(), path.join(dataDir(), `db.before-restore-${ts}.json`));
    fs.writeFileSync(dbFile(), JSON.stringify(j));
    if (resumes) { // restore the Resume folder exactly as it was in the backup (the current one is kept aside)
      if (fs.existsSync(resumeDir())) fs.renameSync(resumeDir(), path.join(dataDir(), `Resume.before-restore-${ts}`));
      fs.mkdirSync(resumeDir(), { recursive: true });
      for (const [name, text] of Object.entries(resumes)) fs.writeFileSync(path.join(resumeDir(), path.basename(name)), text);
    }
  } catch (e) { dialog.showErrorBox('Restore failed', String(e.message || e)); }
  writeCfg({ pendingRestore: null });
}

// ---------- backups ----------
function backupNow() {
  const { backupDir } = readCfg();
  if (!backupDir) throw new Error('Choose a backup folder first');
  if (!fs.existsSync(dbFile()) && !fs.existsSync(resumeDir())) throw new Error('Nothing to back up yet');
  if (!fs.existsSync(dbFile())) fs.writeFileSync(dbFile(), '{}');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dest = path.join(backupDir, `outreach-backup-${stamp}.json`);
  const j = JSON.parse(fs.readFileSync(dbFile(), 'utf8'));
  j.__resumes = {};
  try { for (const f of fs.readdirSync(resumeDir())) if (f.toLowerCase().endsWith('.json')) j.__resumes[f] = fs.readFileSync(path.join(resumeDir(), f), 'utf8'); } catch { /* no resumes yet */ }
  fs.writeFileSync(dest, JSON.stringify(j));
  const old = fs.readdirSync(backupDir).filter((f) => /^outreach-backup-.*\.json$/.test(f)).sort().reverse().slice(30); // keep newest 30
  old.forEach((f) => fs.rmSync(path.join(backupDir, f), { force: true }));
  writeCfg({ lastBackup: Date.now() });
  return { file: dest, at: Date.now() };
}
function autoBackup() { const c = readCfg(); if (c.backupDir && Date.now() - (c.lastBackup || 0) > 20 * 3600 * 1000) { try { backupNow(); } catch { /* folder unavailable */ } } }

const info = () => { const c = readCfg(); return { dataDir: dataDir(), resumeDir: resumeDir(), isDefault: !c.dataDir, defaultDataDir: defaultDataDir(), backupDir: c.backupDir || '', lastBackup: c.lastBackup || 0, version: app.getVersion() }; };
function relaunch() { quitting = true; app.relaunch(); app.exit(0); }

ipcMain.handle('desktop:info', () => info());
ipcMain.handle('desktop:openDataDir', () => shell.openPath(dataDir()));
ipcMain.handle('desktop:openBackupDir', () => { const d = readCfg().backupDir; return d ? shell.openPath(d) : 'No backup folder chosen'; });
ipcMain.handle('desktop:openResumeDir', () => { fs.mkdirSync(resumeDir(), { recursive: true }); return shell.openPath(resumeDir()); });
// "Download PDF" in the resume editor: save a real (vector, selectable-text) PDF through a Save dialog
ipcMain.handle('desktop:printPdf', async (e, title) => {
  const dir = path.join(resumeDir(), 'PDF'); fs.mkdirSync(dir, { recursive: true });
  const r = await dialog.showSaveDialog(win, { title: 'Save resume as PDF', defaultPath: path.join(dir, `${safeFile(title)}.pdf`), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return null;
  const buf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { marginType: 'none' } });
  fs.writeFileSync(r.filePath, buf); shell.showItemInFolder(r.filePath);
  return r.filePath;
});
ipcMain.handle('desktop:backupNow', () => backupNow());
ipcMain.handle('desktop:chooseBackupDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose backup folder', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  writeCfg({ backupDir: r.filePaths[0] }); return info();
});
ipcMain.handle('desktop:chooseDataDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose where Outreach Mailer keeps its data', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const target = r.filePaths[0];
  if (path.resolve(target) === path.resolve(dataDir())) return info();
  const hasData = fs.existsSync(path.join(target, 'db.json')) || fs.existsSync(path.join(target, 'Resume'));
  const { response } = await dialog.showMessageBox(win, { type: 'question', buttons: ['Cancel', hasData ? 'Use the data in that folder' : 'Move my data there'], defaultId: 1, cancelId: 0,
    message: hasData ? 'That folder already contains Outreach Mailer data.' : `Move your data and Resume folder to ${target}?`,
    detail: hasData ? 'The app will restart and use that data. Your current data stays untouched in the old folder.' : 'Your emails, documents and settings will be copied there and the app will restart.' });
  if (response !== 1) return null;
  if (!hasData) {
    await sleep(400); fs.mkdirSync(target, { recursive: true });
    if (fs.existsSync(dbFile())) fs.copyFileSync(dbFile(), path.join(target, 'db.json'));
    if (fs.existsSync(resumeDir())) fs.cpSync(resumeDir(), path.join(target, 'Resume'), { recursive: true });
  }
  writeCfg({ dataDir: target }); relaunch(); return null;
});
ipcMain.handle('desktop:restore', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a backup file', defaultPath: readCfg().backupDir || undefined, filters: [{ name: 'Outreach backup', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { const j = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); if (!j.emails && !j.settings && !j.documents && !j.__resumes) throw new Error('not a backup'); }
  catch { throw new Error('That file is not an Outreach Mailer backup'); }
  const { response } = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancel', 'Restore and restart'], defaultId: 0, cancelId: 0,
    message: 'Replace your current data with this backup?', detail: 'Your current data is kept as db.before-restore-….json in the data folder.' });
  if (response !== 1) return null;
  writeCfg({ pendingRestore: r.filePaths[0] }); relaunch(); return null;
});

// ---------- server & window ----------
const freePort = () => new Promise((resolve) => {
  const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});

async function startServer() {
  applyPendingRestore();
  try { fs.mkdirSync(dataDir(), { recursive: true }); fs.accessSync(dataDir(), fs.constants.W_OK); }
  catch (e) {
    dialog.showMessageBox({ type: 'warning', message: 'Your data folder is not available', detail: `${dataDir()}\n\nUsing the default location instead. You can choose the folder again in Settings.` });
    writeCfg({ dataDir: '' });
  }
  port = await freePort();
  Object.assign(process.env, { PORT: String(port), OUTREACH_DESKTOP: '1', DATA_DIR: dataDir() });
  delete process.env.APP_PASSWORD; // desktop = single user, no login
  await import(pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href);
  for (let i = 0; i < 50; i++) { // wait until the server answers
    try { if ((await fetch(`${base()}/api/me`)).ok) return; } catch { /* not yet */ }
    await sleep(200);
  }
  throw new Error('The local server did not start');
}

function createWindow() {
  win = new BrowserWindow({ width: 1320, height: 860, minWidth: 420, minHeight: 600, show: false, title: 'Outreach Mailer',
    icon: appIcon(), autoHideMenuBar: true, backgroundColor: '#1a1a1b',
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.cjs') } });
  win.setIcon(appIcon());
  win.once('ready-to-show', () => win.show());
  win.loadURL(base());
  win.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(base())) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(base())) { e.preventDefault(); shell.openExternal(url); } });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault(); win.hide();
    if (!told) { told = true; new Notification({ title: 'Outreach Mailer is still running', icon: icon('icon.png'), body: 'It stays in the system tray so scheduled emails keep going out. Right-click the tray icon to quit.' }).show(); }
  });
}
const showWindow = () => { if (!win) createWindow(); win.show(); win.focus(); };

function buildTray() {
  tray = new Tray(process.platform === 'win32' ? appIcon().resize({ width: 16, height: 16 }) : nativeImage.createFromPath(icon('tray.png')).resize({ width: 18, height: 18 }));
  tray.on('click', showWindow);
  refreshTray();
}
function refreshTray() {
  tray.setToolTip(scheduled ? `Outreach Mailer - ${scheduled} email(s) scheduled` : 'Outreach Mailer');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Outreach Mailer', click: showWindow },
    { label: scheduled ? `${scheduled} email(s) scheduled` : 'Nothing scheduled', enabled: false },
    { type: 'separator' },
    { label: 'Start when I sign in', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { type: 'separator' },
    { label: 'Quit', click: quit },
  ]));
}
async function quit() {
  if (scheduled) {
    const { response } = await dialog.showMessageBox({ type: 'warning', buttons: ['Keep running', 'Quit anyway'], defaultId: 0, cancelId: 0,
      message: `${scheduled} email(s) are still scheduled.`, detail: 'They will not be sent while the app is closed. Emails that miss their time are flagged so you can reschedule them.' });
    if (response === 0) return;
  }
  quitting = true; app.quit();
}

// keep the computer awake while something is scheduled; refresh the tray text
async function poll() {
  try {
    const d = await (await fetch(`${base()}/api/overview`)).json();
    scheduled = d.counts?.scheduled || 0;
    if (unread !== null && d.unreadReplies > unread) new Notification({ title: 'New reply', icon: icon('icon.png'), body: `${d.unreadReplies - unread} new repl${d.unreadReplies - unread > 1 ? 'ies' : 'y'} to your emails` }).show();
    unread = d.unreadReplies || 0;
    if (scheduled && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension');
    if (!scheduled && blocker !== null) { powerSaveBlocker.stop(blocker); blocker = null; }
    refreshTray(); autoBackup();
  } catch { /* server busy */ }
}

app.on('second-instance', showWindow);
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* stay alive in the tray */ });
app.on('activate', showWindow);

app.whenReady().then(async () => {
  try { await startServer(); } catch (e) { dialog.showErrorBox('Outreach Mailer could not start', String(e.stack || e)); app.exit(1); return; }
  createWindow(); buildTray(); poll(); setInterval(poll, 30000);
});
