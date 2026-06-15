import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.join(__dirname, '../dist/index.html');

const MAX_EXTERNAL_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXTERNAL_EXTENSIONS = new Set(['.json', '.jwk']);

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {string[]} */
const externalFileQueue = [];

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
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

function sendExternalFileOpened(filePath) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.show();
  mainWindow.focus();

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

  if (stats.size > MAX_EXTERNAL_FILE_BYTES) {
    throw new Error('File exceeds the maximum allowed size (2 MB).');
  }

  return resolved;
}

ipcMain.handle('external-file:read', async (_event, filePath) => {
  const resolved = assertAllowedExternalFile(filePath);
  const text = await fsPromises.readFile(resolved, 'utf8');

  if (Buffer.byteLength(text, 'utf8') > MAX_EXTERNAL_FILE_BYTES) {
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

app.whenReady().then(() => {
  enqueueExternalFiles(parseFilePathsFromArgv(process.argv));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  enqueueExternalFiles([filePath]);
  flushExternalFileQueue();
});
