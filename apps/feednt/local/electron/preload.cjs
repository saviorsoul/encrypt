const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  writeTextToClipboard: (text) =>
    ipcRenderer.invoke('clipboard:write-text', text),
  pickPrivateKeyJwkText: () =>
    ipcRenderer.invoke('private-key:pick-from-dialog'),
  setAuthState: (state) =>
    ipcRenderer.send('private-key:safe-storage:set-auth-state', state),
  privateKeySafeStorage: {
    getStatus: () => ipcRenderer.invoke('private-key:safe-storage:get-status'),
    beginSession: (keyId) =>
      ipcRenderer.invoke('private-key:safe-storage:begin-session', keyId),
    has: (keyId) => ipcRenderer.invoke('private-key:safe-storage:has', keyId),
    store: (keyId, jwkText) =>
      ipcRenderer.invoke('private-key:safe-storage:store', keyId, jwkText),
    load: (keyId) =>
      ipcRenderer.invoke('private-key:safe-storage:load', keyId),
    listPrivateKeyIds: () =>
      ipcRenderer.invoke('private-key:safe-storage:list-ids'),
    loadSolePrivateKey: () =>
      ipcRenderer.invoke('private-key:safe-storage:load-sole'),
    armSession: (keyId) =>
      ipcRenderer.invoke('private-key:safe-storage:arm-session', keyId),
    clearAllForCleanLocalData: () =>
      ipcRenderer.invoke(
        'private-key:safe-storage:clear-all-for-clean-local-data',
      ),
    getSessionState: () =>
      ipcRenderer.invoke('private-key:safe-storage:get-session-state'),
  },
});
