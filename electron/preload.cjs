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
  writeTextToClipboard: (text) =>
    ipcRenderer.invoke('clipboard:write-text', text),
  dismissExternalFile: (filePath) =>
    ipcRenderer.invoke('external-file:consume', filePath),
  setTrayAuthState: (state) => {
    ipcRenderer.send('tray:set-auth-state', state);
  },
  setTrayRecipients: (state) => {
    ipcRenderer.send('tray:set-recipients', state);
  },
  pickPrivateKeyJwkText: () =>
    ipcRenderer.invoke('private-key:pick-from-dialog'),
  showMainWindow: () => ipcRenderer.invoke('window:show'),
  flashTraySuccess: () => ipcRenderer.invoke('tray:flash-success'),
  onTrayEncryptCopiedMessage: (callback) => {
    const listener = (_event, payload) => {
      callback(payload);
    };

    ipcRenderer.on('tray:encrypt-copied-message', listener);

    return () => {
      ipcRenderer.removeListener('tray:encrypt-copied-message', listener);
    };
  },
});
