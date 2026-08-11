import { app, BrowserWindow, clipboard, dialog, ipcMain, session } from 'electron';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFeedntElectronCsp } from './csp.js';
import {
  clearAllStoredPrivateKeys,
  getPrivateKeyEncryptionStatus,
  hasStoredPrivateKey,
  listStoredPrivateKeyIds,
  loadPrivateKeyJwk,
  loadSoleStoredPrivateKeyJwk,
  storePrivateKeyJwk,
} from '@encrypt/platform/electron/safeStoragePrivateKey';
import {
  armPrivateKeySafeStorageSession,
  assertPrivateKeySafeStorageHas,
  assertPrivateKeySafeStorageLoad,
  assertPrivateKeySafeStorageStore,
  beginPrivateKeySafeStorageSession,
  getPrivateKeySafeStorageSessionState,
  resetPrivateKeySafeStorageSession,
  setPrivateKeySafeStorageAuthState,
} from '@encrypt/platform/electron/privateKeySafeStorageSession';

const MAX_IMPORT_JSON_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRIVATE_KEY_EXTENSIONS = new Set(['.jwk', '.json']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.join(__dirname, '../dist/index.html');

/** @type {BrowserWindow | null} */
let mainWindow = null;

function isElectronDevServer() {
  return Boolean(process.env.VITE_DEV_SERVER_URL);
}

function configureContentSecurityPolicy() {
  const policy = getFeedntElectronCsp(isElectronDevServer());

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isElectronDevServer()) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(distIndexPath);
  }
}

function assertAllowedPrivateKeyFile(filePath) {
  const resolved = path.resolve(filePath);
  const extension = path.extname(resolved).toLowerCase();

  if (!ALLOWED_PRIVATE_KEY_EXTENSIONS.has(extension)) {
    throw new Error('Only .json and .jwk files are accepted.');
  }

  let stats;
  try {
    stats = fs.statSync(resolved);
  } catch {
    throw new Error('File not found.');
  }

  if (!stats.isFile()) {
    throw new Error('Path is not a file.');
  }

  if (stats.size > MAX_IMPORT_JSON_FILE_BYTES) {
    throw new Error(
      `File exceeds the maximum allowed size (${Math.floor(MAX_IMPORT_JSON_FILE_BYTES / (1024 * 1024))} MB).`,
    );
  }

  return resolved;
}

async function pickPrivateKeyJwkTextFromDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { cancelled: true };
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select private key',
    properties: ['openFile'],
    filters: [{ name: 'Private key', extensions: ['jwk', 'json'] }],
  });

  if (canceled || filePaths.length === 0) {
    return { cancelled: true };
  }

  let resolved;
  try {
    resolved = assertAllowedPrivateKeyFile(filePaths[0]);
  } catch (error) {
    return {
      cancelled: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not open private key file.',
    };
  }

  try {
    const text = await fsPromises.readFile(resolved, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_JSON_FILE_BYTES) {
      return {
        cancelled: false,
        error: `Private key file exceeds the maximum allowed size (${Math.floor(MAX_IMPORT_JSON_FILE_BYTES / (1024 * 1024))} MB).`,
      };
    }
    return { cancelled: false, text };
  } catch {
    return {
      cancelled: false,
      error: 'Could not read private key file.',
    };
  }
}

function assertPrivateKeyIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window is not available.');
  }

  if (event.sender !== mainWindow.webContents) {
    throw new Error('Request is not allowed from this context.');
  }
}

ipcMain.handle('clipboard:write-text', (_event, text) => {
  if (typeof text !== 'string') {
    throw new Error('Clipboard text must be a string.');
  }
  clipboard.writeText(text);
});

ipcMain.handle('private-key:pick-from-dialog', async (event) => {
  assertPrivateKeyIpcSender(event);
  return pickPrivateKeyJwkTextFromDialog();
});

ipcMain.on('private-key:safe-storage:set-auth-state', (_event, state) => {
  setPrivateKeySafeStorageAuthState({
    isLoggedIn: Boolean(state?.isLoggedIn),
    keyId: typeof state?.keyId === 'string' ? state.keyId : null,
  });
});

ipcMain.handle('private-key:safe-storage:get-status', (event) => {
  assertPrivateKeyIpcSender(event);
  return getPrivateKeyEncryptionStatus();
});

ipcMain.handle('private-key:safe-storage:begin-session', (event, keyId) => {
  assertPrivateKeyIpcSender(event);
  if (typeof keyId !== 'string') {
    throw new Error('Private key session requires a keyId string.');
  }
  beginPrivateKeySafeStorageSession(keyId);
});

ipcMain.handle(
  'private-key:safe-storage:store',
  async (event, keyId, jwkText) => {
    assertPrivateKeyIpcSender(event);
    if (typeof keyId !== 'string' || typeof jwkText !== 'string') {
      throw new Error('Private key store requires keyId and jwkText strings.');
    }
    assertPrivateKeySafeStorageStore(keyId);
    await storePrivateKeyJwk(app.getPath('userData'), keyId, jwkText);
  },
);

ipcMain.handle('private-key:safe-storage:has', async (event, keyId) => {
  assertPrivateKeyIpcSender(event);
  if (typeof keyId !== 'string') {
    throw new Error('Private key lookup requires a keyId string.');
  }
  assertPrivateKeySafeStorageHas(keyId);
  return hasStoredPrivateKey(app.getPath('userData'), keyId);
});

ipcMain.handle('private-key:safe-storage:load', async (event, keyId) => {
  assertPrivateKeyIpcSender(event);
  if (typeof keyId !== 'string') {
    throw new Error('Private key load requires a keyId string.');
  }
  assertPrivateKeySafeStorageLoad(keyId);
  const jwkText = await loadPrivateKeyJwk(app.getPath('userData'), keyId);
  if (!jwkText) {
    return null;
  }
  return { keyId, jwkText };
});

ipcMain.handle('private-key:safe-storage:list-ids', async (event) => {
  assertPrivateKeyIpcSender(event);
  return listStoredPrivateKeyIds(app.getPath('userData'));
});

ipcMain.handle('private-key:safe-storage:load-sole', async (event) => {
  assertPrivateKeyIpcSender(event);
  return loadSoleStoredPrivateKeyJwk(app.getPath('userData'));
});

ipcMain.handle('private-key:safe-storage:arm-session', (event, keyId) => {
  assertPrivateKeyIpcSender(event);
  if (typeof keyId !== 'string') {
    throw new Error('Private key arm-session requires a keyId string.');
  }
  armPrivateKeySafeStorageSession(keyId);
});

if (!app.isPackaged) {
  ipcMain.handle('private-key:safe-storage:get-session-state', (event) => {
    assertPrivateKeyIpcSender(event);
    return getPrivateKeySafeStorageSessionState();
  });
}

ipcMain.handle(
  'private-key:safe-storage:clear-all-for-clean-local-data',
  async (event) => {
    assertPrivateKeyIpcSender(event);
    await clearAllStoredPrivateKeys(app.getPath('userData'));
    resetPrivateKeySafeStorageSession();
  },
);

app.whenReady().then(() => {
  configureContentSecurityPolicy();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
