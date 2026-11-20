const { contextBridge, ipcRenderer } = require('electron');
const call = (name) => (...a) => ipcRenderer.invoke(`desktop:${name}`, ...a);
contextBridge.exposeInMainWorld('desktop', {
  info: call('info'), chooseDataDir: call('chooseDataDir'), openDataDir: call('openDataDir'),
  chooseBackupDir: call('chooseBackupDir'), openBackupDir: call('openBackupDir'), backupNow: call('backupNow'), restore: call('restore'), openResumeDir: call('openResumeDir'), printPdf: call('printPdf'),
});
