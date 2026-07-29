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
  privateKeySafeStorage: {
    getStatus: () => ipcRenderer.invoke('private-key:safe-storage:get-status'),
    beginSession: (keyId) =>
      ipcRenderer.invoke('private-key:safe-storage:begin-session', keyId),
    has: (keyId) => ipcRenderer.invoke('private-key:safe-storage:has', keyId),
    store: (keyId, jwkText) =>
      ipcRenderer.invoke('private-key:safe-storage:store', keyId, jwkText),
    load: (keyId) =>
      ipcRenderer.invoke('private-key:safe-storage:load', keyId),
    armSession: (keyId) =>
      ipcRenderer.invoke('private-key:safe-storage:arm-session', keyId),
    clearAllForCleanLocalData: () =>
      ipcRenderer.invoke(
        'private-key:safe-storage:clear-all-for-clean-local-data',
      ),
    getSessionState: () =>
      ipcRenderer.invoke('private-key:safe-storage:get-session-state'),
  },
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
  onDeepLinkActionRequest: (callback) => {
    const listener = (_event, action) => {
      callback(action);
    };

    ipcRenderer.on('deep-link:action-request', listener);

    return () => {
      ipcRenderer.removeListener('deep-link:action-request', listener);
    };
  },
  onDeepLinkError: (callback) => {
    const listener = (_event, payload) => {
      callback(payload);
    };

    ipcRenderer.on('deep-link:error', listener);

    return () => {
      ipcRenderer.removeListener('deep-link:error', listener);
    };
  },
  consumePendingDeepLinkAction: () =>
    ipcRenderer.invoke('deep-link:consume-pending-action'),
  getProtocolHandlerStatus: () =>
    ipcRenderer.invoke('protocol:get-handler-status'),
  restoreDefaultProtocolHandler: () =>
    ipcRenderer.invoke('protocol:restore-default-handler'),
});
