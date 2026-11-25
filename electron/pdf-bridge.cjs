// Extra preload script (registered from main.cjs). Exposes window.desktopPdf.print() to the editor page.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopPdf', { print: () => ipcRenderer.invoke('desktop:printPdf') });
