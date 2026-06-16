import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  session,
  Tray,
} from 'electron';
import { getContentSecurityPolicy } from './csp.js';
import {
  MAX_IMPORT_JSON_FILE_BYTES,
  validateBaseJsonText,
} from './validateBaseJsonText.js';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.join(__dirname, '../dist/index.html');

const ALLOWED_EXTERNAL_EXTENSIONS = new Set(['.json', '.jwk']);
const CLIPBOARD_IMPORT_SOURCE_NAME = 'Clipboard';

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {Tray | null} */
let tray = null;

/** @type {boolean} */
let isQuitting = false;

/** @type {boolean} */
let trayCanExportPublicKey = false;

/** @type {boolean} */
let trayIsLoggedIn = false;

/** @type {string | null} */
let trayPublicKeyText = null;

/** @type {string[]} */
let trayRecipientUsernames = [];

/** @type {string[]} */
const externalFileQueue = [];

/** @type {{ text: string; sourceName: string } | { error: string; sourceName: string } | null} */
let pendingClipboardImport = null;

/** @type {{ username: string; plaintext?: string; error?: string } | null} */
let pendingTrayEncryptCopiedMessage = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    showMainWindow();
    enqueueExternalFiles(parseFilePathsFromArgv(argv));
    flushExternalFileQueue();
  });
}

function parseFilePathsFromArgv(argv) {
  /** @type {string[]} */
  const paths = [];

  for (const arg of argv) {
    if (!arg || arg.startsWith('-')) {
      continue;
    }

    let resolved;
    try {
      resolved = path.resolve(arg);
    } catch {
      continue;
    }

    try {
      const stats = fs.statSync(resolved);
      if (!stats.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    const extension = path.extname(resolved).toLowerCase();
    if (!ALLOWED_EXTERNAL_EXTENSIONS.has(extension)) {
      continue;
    }

    if (!paths.includes(resolved)) {
      paths.push(resolved);
    }
  }

  return paths;
}

function enqueueExternalFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!externalFileQueue.includes(filePath)) {
      externalFileQueue.push(filePath);
    }
  }
}

function dequeueExternalFile(filePath) {
  const index = externalFileQueue.indexOf(filePath);
  if (index >= 0) {
    externalFileQueue.splice(index, 1);
  }
}

function getExternalFileMetadata(filePath) {
  const resolved = path.resolve(filePath);
  const stats = fs.statSync(resolved);

  return {
    path: resolved,
    name: path.basename(resolved),
    size: stats.size,
  };
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function sendExternalFileOpened(filePath) {
  showMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(
    'external-file:opened',
    getExternalFileMetadata(filePath),
  );
}

function flushExternalFileQueue() {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    externalFileQueue.length === 0
  ) {
    return;
  }

  sendExternalFileOpened(externalFileQueue[0]);
}

function sendExternalTextImported(payload) {
  showMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingClipboardImport = payload;
    return;
  }

  mainWindow.webContents.send('external-text:imported', payload);
}

function flushPendingClipboardImport() {
  if (!pendingClipboardImport || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('external-text:imported', pendingClipboardImport);
  pendingClipboardImport = null;
}

function sendTrayEncryptCopiedMessage(payload) {
  showMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingTrayEncryptCopiedMessage = payload;
    return;
  }

  mainWindow.webContents.send('tray:encrypt-copied-message', payload);
}

function flushPendingTrayEncryptCopiedMessage() {
  if (
    !pendingTrayEncryptCopiedMessage ||
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return;
  }

  mainWindow.webContents.send(
    'tray:encrypt-copied-message',
    pendingTrayEncryptCopiedMessage,
  );
  pendingTrayEncryptCopiedMessage = null;
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
    resolved = assertAllowedExternalFile(filePaths[0]);
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
        error: 'Private key file exceeds the maximum allowed size (2 MB).',
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

async function requestTrayEncryptCopiedMessage(username) {
  if (!trayIsLoggedIn) {
    return;
  }

  const plaintext = clipboard.readText();
  showMainWindow();

  if (!plaintext.trim()) {
    sendTrayEncryptCopiedMessage({
      username,
      error: 'Clipboard is empty.',
    });
    return;
  }

  const keyResult = await pickPrivateKeyJwkTextFromDialog();
  if (keyResult.cancelled) {
    return;
  }

  if (keyResult.error) {
    sendTrayEncryptCopiedMessage({
      username,
      error: keyResult.error,
    });
    return;
  }

  sendTrayEncryptCopiedMessage({
    username,
    plaintext,
    privateKeyText: keyResult.text,
  });
}

function importTextFromClipboard() {
  const validated = validateBaseJsonText(clipboard.readText());
  if (!validated.ok) {
    sendExternalTextImported({
      sourceName: CLIPBOARD_IMPORT_SOURCE_NAME,
      error: validated.error,
    });
    return;
  }

  sendExternalTextImported({
    sourceName: CLIPBOARD_IMPORT_SOURCE_NAME,
    text: validated.text,
  });
}

function getTrayIconPath() {
  if (process.platform === 'linux') {
    return path.join(__dirname, 'tray-icon.png');
  }

  const distIcon = path.join(__dirname, '../dist/favicon.ico');
  if (fs.existsSync(distIcon)) {
    return distIcon;
  }

  return path.join(__dirname, '../public/favicon.ico');
}

function createTrayIcon() {
  const iconPath = getTrayIconPath();

  // Linux only supports PNG tray icons; .ico often fails and shows a placeholder.
  if (process.platform === 'linux') {
    return iconPath;
  }

  return nativeImage.createFromPath(iconPath);
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    {
      label: 'Show Encrypt',
      click: () => {
        showMainWindow();
      },
    },
  ];

  if (trayCanExportPublicKey) {
    template.push({
      label: 'Copy public key',
      click: () => {
        if (trayPublicKeyText) {
          clipboard.writeText(trayPublicKeyText);
        }
      },
    });
  }

  template.push({
    label: 'Import encrypted text',
    click: () => {
      importTextFromClipboard();
    },
  });

  if (trayIsLoggedIn) {
    /** @type {Electron.MenuItemConstructorOptions[]} */
    const encryptCopiedMessageSubmenu =
      trayRecipientUsernames.length > 0
        ? trayRecipientUsernames.map((username) => ({
            label: username,
            click: () => {
              void requestTrayEncryptCopiedMessage(username);
            },
          }))
        : [{ label: 'No recipients', enabled: false }];

    template.push({
      label: 'Encrypt copied message',
      submenu: encryptCopiedMessageSubmenu,
    });
  } else {
    template.push({
      label: 'Encrypt copied message',
      enabled: false,
    });
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Encrypt');
  updateTrayMenu();
  tray.on('double-click', () => {
    showMainWindow();
  });
  tray.on('click', () => {
    if (process.platform === 'linux') {
      showMainWindow();
    }
  });
}

function isElectronDevServer() {
  return Boolean(process.env.VITE_DEV_SERVER_URL);
}

function configureContentSecurityPolicy() {
  const policy = getContentSecurityPolicy(
    isElectronDevServer() ? 'development' : 'production',
  );

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

function blockRemoteNetworkRequests() {
  if (isElectronDevServer()) {
    return;
  }

  session.defaultSession.webRequest.onBeforeRequest(
    {
      urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'],
    },
    (_details, callback) => {
      callback({ cancel: true });
    },
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const devServerUrl = isElectronDevServer()
    ? process.env.VITE_DEV_SERVER_URL
    : null;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(distIndexPath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    flushExternalFileQueue();
    flushPendingClipboardImport();
    flushPendingTrayEncryptCopiedMessage();
  });
}

function assertAllowedExternalFile(filePath) {
  const resolved = path.resolve(filePath);
  const extension = path.extname(resolved).toLowerCase();

  if (!ALLOWED_EXTERNAL_EXTENSIONS.has(extension)) {
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
    throw new Error('File exceeds the maximum allowed size (2 MB).');
  }

  return resolved;
}

ipcMain.handle('clipboard:write-text', (_event, text) => {
  if (typeof text !== 'string') {
    throw new Error('Clipboard text must be a string.');
  }

  clipboard.writeText(text);
});

ipcMain.handle('external-file:read', async (_event, filePath) => {
  const resolved = assertAllowedExternalFile(filePath);
  const text = await fsPromises.readFile(resolved, 'utf8');

  if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_JSON_FILE_BYTES) {
    throw new Error('File exceeds the maximum allowed size (2 MB).');
  }

  return {
    path: resolved,
    name: path.basename(resolved),
    text,
  };
});

ipcMain.handle('external-file:consume', (_event, filePath) => {
  dequeueExternalFile(filePath);
  flushExternalFileQueue();
});

ipcMain.on('tray:set-auth-state', (_event, state) => {
  trayCanExportPublicKey = Boolean(state?.canExportPublicKey);
  trayIsLoggedIn = Boolean(state?.isLoggedIn);
  trayPublicKeyText =
    typeof state?.publicKeyText === 'string' ? state.publicKeyText : null;
  updateTrayMenu();
});

ipcMain.on('tray:set-recipients', (_event, state) => {
  trayRecipientUsernames = Array.isArray(state?.usernames)
    ? state.usernames.filter(
        (username) => typeof username === 'string' && username.length > 0,
      )
    : [];
  updateTrayMenu();
});

app.whenReady().then(() => {
  configureContentSecurityPolicy();
  blockRemoteNetworkRequests();
  enqueueExternalFiles(parseFilePathsFromArgv(process.argv));
  createTray();
  createWindow();

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow();
      return;
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  enqueueExternalFiles([filePath]);
  flushExternalFileQueue();
});
