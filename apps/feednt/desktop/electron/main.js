import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  session,
  Tray,
} from 'electron';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFeedntElectronCsp } from './csp.js';
import {
  prepareAppForQuit,
  registerPowerMonitorShutdownHandler,
  registerShutdownSignalHandlers,
  registerWindowsSessionEndHandler,
} from './shutdown.js';
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
const LINUX_WM_CLASS = 'feednt';

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', LINUX_WM_CLASS);
}

const TRAY_TOOLTIP_DEFAULT = 'Feednt';

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {Tray | null} */
let tray = null;

/** @type {NodeJS.Timeout | null} */
let traySuccessIconTimeout = null;

/** @type {boolean} */
let isQuitting = false;

function requestGracefulQuit() {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  app.quit();
}

function applyPreparedQuitState() {
  const next = prepareAppForQuit({
    isQuitting,
    tray,
    traySuccessIconTimeout,
    mainWindow,
  });
  isQuitting = next.isQuitting;
  tray = next.tray;
  traySuccessIconTimeout = next.traySuccessIconTimeout;
  mainWindow = next.mainWindow;
}

registerShutdownSignalHandlers({
  process,
  onShutdownSignal: requestGracefulQuit,
});

registerPowerMonitorShutdownHandler({
  powerMonitor,
  process,
  onShutdownSignal: requestGracefulQuit,
});

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

function getAppIconPath() {
  const electronIcon = resolveElectronAssetPath('icon.png');
  if (fs.existsSync(electronIcon)) {
    return electronIcon;
  }

  const distIcon = path.join(__dirname, '../dist/favicon.svg');
  if (fs.existsSync(distIcon)) {
    return distIcon;
  }

  return path.join(__dirname, '../../public/favicon.svg');
}

function getAppIconImage() {
  const iconPath = getAppIconPath();
  let image = nativeImage.createFromPath(iconPath);

  if (image.isEmpty()) {
    image = nativeImage.createFromBuffer(fs.readFileSync(iconPath));
  }

  return image;
}

function resolveElectronAssetPath(fileName) {
  const bundledPath = path.join(__dirname, fileName);
  if (!app.isPackaged) {
    return bundledPath;
  }

  const unpackedPath = bundledPath.replace(
    `${path.sep}app.asar${path.sep}`,
    `${path.sep}app.asar.unpacked${path.sep}`,
  );
  if (fs.existsSync(unpackedPath)) {
    return unpackedPath;
  }

  return bundledPath;
}

function getTrayIconFileName() {
  if (process.platform === 'win32') {
    return 'tray-icon.ico';
  }

  if (process.platform === 'linux') {
    try {
      const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
      return scaleFactor >= 2 ? 'tray-icon-48.png' : 'tray-icon-24.png';
    } catch {
      return 'tray-icon-24.png';
    }
  }

  return 'tray-icon.png';
}

function getTrayIconPath() {
  const trayFileName = getTrayIconFileName();
  const trayPath = resolveElectronAssetPath(trayFileName);
  if (fs.existsSync(trayPath)) {
    return trayPath;
  }

  const trayPng = resolveElectronAssetPath('tray-icon.png');
  if (fs.existsSync(trayPng)) {
    return trayPng;
  }

  return getAppIconPath();
}

function loadTrayNativeImage(iconPath) {
  let image = nativeImage.createFromPath(iconPath);

  if (image.isEmpty()) {
    image = nativeImage.createFromBuffer(fs.readFileSync(iconPath));
  }

  return image;
}

function createTrayIcon() {
  const iconPath = getTrayIconPath();

  // GTK StatusNotifier on Linux needs a real filesystem path, not an asar path.
  if (process.platform === 'linux' || process.platform === 'win32') {
    return iconPath;
  }

  const image = loadTrayNativeImage(iconPath);
  if (!image.isEmpty()) {
    return image;
  }

  return loadTrayNativeImage(resolveElectronAssetPath('icon.png'));
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const template = [
    {
      label: 'Show Feednt',
      click: () => {
        showMainWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        requestGracefulQuit();
      },
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  try {
    tray = new Tray(createTrayIcon());
  } catch (error) {
    console.error('Failed to create system tray icon:', error);
    return;
  }

  tray.setToolTip(TRAY_TOOLTIP_DEFAULT);
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

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow({ showOnReady: true });
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createWindow({ showOnReady = true } = {}) {
  const windowIcon =
    process.platform === 'linux' ? getAppIconImage() : getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (showOnReady) {
    mainWindow.once('ready-to-show', () => {
      if (process.platform === 'linux') {
        const icon = getAppIconImage();
        if (!icon.isEmpty()) {
          mainWindow?.setIcon(icon);
        }
      }

      mainWindow?.show();
    });
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  registerWindowsSessionEndHandler({
    window: mainWindow,
    process,
    onSystemSessionEnd: () => {
      if (isQuitting) {
        return;
      }

      applyPreparedQuitState();
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
  applyPreparedQuitState();
});
