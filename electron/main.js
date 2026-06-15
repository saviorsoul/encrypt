import {
  app,
  BrowserWindow,
  clipboard,
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

/** @type {string | null} */
let trayPublicKeyText = null;

/** @type {string[]} */
const externalFileQueue = [];

/** @type {{ text: string; sourceName: string } | { error: string; sourceName: string } | null} */
let pendingClipboardImport = null;

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

function configureContentSecurityPolicy() {
  const policy = getContentSecurityPolicy(
    process.env.VITE_DEV_SERVER_URL ? 'development' : 'production',
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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(distIndexPath);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    flushExternalFileQueue();
    flushPendingClipboardImport();
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
  trayPublicKeyText =
    typeof state?.publicKeyText === 'string' ? state.publicKeyText : null;
  updateTrayMenu();
});

app.whenReady().then(() => {
  configureContentSecurityPolicy();
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
