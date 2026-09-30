// Exposes only the window controls to the page; marks the page as running inside the desktop app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('forceStudio', {
  min: () => ipcRenderer.send('win', 'min'),
  max: () => ipcRenderer.send('win', 'max'),
  close: () => ipcRenderer.send('win', 'close'),
});

window.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('is-desktop'));
