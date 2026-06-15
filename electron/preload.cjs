const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  onExternalFileOpened: (callback) => {
    const listener = (_event, metadata) => {
      callback(metadata);
    };

    ipcRenderer.on('external-file:opened', listener);

    return () => {
      ipcRenderer.removeListener('external-file:opened', listener);
    };
  },
  onExternalTextImported: (callback) => {
    const listener = (_event, payload) => {
      callback(payload);
    };

    ipcRenderer.on('external-text:imported', listener);

    return () => {
      ipcRenderer.removeListener('external-text:imported', listener);
    };
  },
  readExternalFile: (filePath) =>
    ipcRenderer.invoke('external-file:read', filePath),
  dismissExternalFile: (filePath) =>
    ipcRenderer.invoke('external-file:consume', filePath),
  setTrayAuthState: (state) => {
    ipcRenderer.send('tray:set-auth-state', state);
  },
});
