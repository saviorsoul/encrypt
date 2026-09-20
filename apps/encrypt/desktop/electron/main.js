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
  shell,
  Tray,
} from 'electron';
import { getContentSecurityPolicy } from './csp.js';
import {
  MAX_IMPORT_JSON_FILE_BYTES,
  validateBaseJsonText,
} from './validateBaseJsonText.js';
import {
  findDeepLinkInArgv,
  parseDeepLink,
  isBackgroundFeedBridgeDeepLinkAction,
} from './deepLinks.js';
import { isEncryptProtocolDeepLinksEnabled } from './encryptProtocolConfig.js';
import { validateFeedLabOpenExternalUrl } from './feedLabBridgeOpenExternal.js';
import {
  FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE,
  isFeedLabProtocolBridgeEnabled,
} from './feedLabBridgeConfig.js';
import {
  isLinuxEncryptProtocolHandlerDefault,
  queryLinuxEncryptProtocolHandler,
  restoreLinuxEncryptProtocolHandler,
} from './protocolHandlerLinux.js';
import {
  clearAllStoredPrivateKeys,
  getPrivateKeyEncryptionStatus,
  hasStoredPrivateKey,
  loadPrivateKeyJwk,
  storePrivateKeyJwk,
} from './safeStoragePrivateKey.js';
import {
  prepareAppForQuit,
  registerPowerMonitorShutdownHandler,
  registerShutdownSignalHandlers,
  registerWindowsSessionEndHandler,
} from './shutdown.js';
import {
  assertPrivateKeySafeStorageHas,
  assertPrivateKeySafeStorageLoad,
  assertPrivateKeySafeStoragePickFromDialog,
  assertPrivateKeySafeStorageStore,
  armPrivateKeySafeStorageSession,
  beginPrivateKeySafeStorageSession,
  getPrivateKeySafeStorageSessionState,
  resetPrivateKeySafeStorageSession,
  setPrivateKeySafeStorageAuthState,
} from './privateKeySafeStorageSession.js';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.join(__dirname, '../dist/index.html');
const LINUX_WM_CLASS = 'encrypt';
const PROTOCOL_SCHEME = 'encrypt';
const encryptProtocolDeepLinksEnabled = isEncryptProtocolDeepLinksEnabled();

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', LINUX_WM_CLASS);
}

const ALLOWED_EXTERNAL_EXTENSIONS = new Set(['.json', '.jwk']);
const CLIPBOARD_IMPORT_SOURCE_NAME = 'Clipboard';

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {Tray | null} */
let tray = null;

/** @type {NodeJS.Timeout | null} */
let traySuccessIconTimeout = null;

const TRAY_TOOLTIP_DEFAULT = 'Encrypt';
const TRAY_TOOLTIP_SUCCESS = 'Encrypted message copied to clipboard';
const TRAY_SUCCESS_ICON_DURATION_MS = 5000;

/** GNOME/Ubuntu panel icon size at 100% scale (StatusNotifier/AppIndicator). */
const LINUX_TRAY_ICON_SIZE = 24;

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

/** @type {import('./deepLinks.js').DeepLinkAction | null} */
let pendingDeepLinkAction = null;

/** @type {{ message: string } | null} */
let pendingDeepLinkError = null;

/** @type {string | null} */
let earlyOpenUrlDeepLink = null;

/** @type {boolean} */
let pendingTrayCopyPublicKey = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (encryptProtocolDeepLinksEnabled && handleDeepLinkLaunchFromArgv(argv)) {
      return;
    }

    showMainWindow();
    enqueueExternalFiles(parseFilePathsFromArgv(argv));
    flushExternalFileQueue();
  });

  // macOS may deliver the URL before ready.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (!encryptProtocolDeepLinksEnabled) {
      return;
    }
    if (app.isReady()) {
      handleDeepLinkUrl(url);
      return;
    }
    earlyOpenUrlDeepLink = url;
  });

  registerShutdownSignalHandlers({
    process,
    onShutdownSignal: requestGracefulQuit,
  });

  registerPowerMonitorShutdownHandler({
    powerMonitor,
    process,
    onShutdownSignal: requestGracefulQuit,
  });
}

function registerDefaultProtocolClient() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
    return;
  }

  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

function isEncryptProtocolDefault() {
  if (process.platform === 'linux') {
    return isLinuxEncryptProtocolHandlerDefault();
  }

  return app.isDefaultProtocolClient(PROTOCOL_SCHEME);
}

function getProtocolHandlerStatus() {
  if (!app.isPackaged) {
    return { applicable: false, isDefault: true, scheme: PROTOCOL_SCHEME };
  }

  const status = {
    applicable: true,
    isDefault: isEncryptProtocolDefault(),
    scheme: PROTOCOL_SCHEME,
  };

  if (process.platform === 'linux') {
    return {
      ...status,
      currentHandler: queryLinuxEncryptProtocolHandler(),
    };
  }

  return status;
}

function restoreDefaultProtocolHandler() {
  if (!app.isPackaged) {
    return {
      applicable: false,
      ok: false,
      isDefault: isEncryptProtocolDefault(),
      scheme: PROTOCOL_SCHEME,
    };
  }

  if (process.platform === 'linux') {
    const ok = restoreLinuxEncryptProtocolHandler();
    registerDefaultProtocolClient();
    const isDefault = isEncryptProtocolDefault();
    return {
      applicable: true,
      ok: ok || isDefault,
      isDefault,
      scheme: PROTOCOL_SCHEME,
    };
  }

  registerDefaultProtocolClient();
  const isDefault = isEncryptProtocolDefault();
  return {
    applicable: true,
    ok: isDefault,
    isDefault,
    scheme: PROTOCOL_SCHEME,
  };
}

/**
 * @param {import('./deepLinks.js').DeepLinkAction} action
 * @returns {boolean}
 */
function isFeedLabBridgeDeepLinkAction(action) {
  return action.type === 'feed-pair' || action.type === 'feed-op';
}

/**
 * @param {string[]} argv
 * @returns {boolean} Whether a deep link launch was handled.
 */
function handleDeepLinkLaunchFromArgv(argv) {
  const deepLink = findDeepLinkInArgv(argv);
  if (deepLink) {
    handleDeepLinkUrl(deepLink);
    return true;
  }

  // Linux desktop launches sometimes pass the URL only after Electron flags;
  // also accept a single bare argv entry that failed the first scan after join.
  const joined = argv.filter((a) => typeof a === 'string').join(' ');
  const embedded = joined.match(/encrypt:\/\/[^\s'"]+/i);
  if (embedded) {
    handleDeepLinkUrl(embedded[0]);
    return true;
  }

  return false;
}

/**
 * @param {string} href
 * @returns {import('./deepLinks.js').DeepLinkAction | null}
 */
function dispatchDeepLinkHref(href) {
  if (!encryptProtocolDeepLinksEnabled) {
    return null;
  }

  const parsed = parseDeepLink(href);
  if (!parsed.ok) {
    if (!parsed.silent) {
      sendDeepLinkError(parsed.error);
    }
    return null;
  }

  dispatchDeepLinkAction(parsed.action);
  return parsed.action;
}

/**
 * @param {string} href
 */
function handleDeepLinkUrl(href) {
  dispatchDeepLinkHref(href);
}

/**
 * Cold-start: open queued files or handle argv / macOS open-url deep link.
 * @returns {{ showWindowOnReady: boolean }}
 */
function runStartupLaunch() {
  const startupDeepLink = encryptProtocolDeepLinksEnabled
    ? (earlyOpenUrlDeepLink ?? findDeepLinkInArgv(process.argv))
    : null;
  earlyOpenUrlDeepLink = null;

  if (!startupDeepLink) {
    enqueueExternalFiles(parseFilePathsFromArgv(process.argv));
    return { showWindowOnReady: true };
  }

  const action = dispatchDeepLinkHref(startupDeepLink);
  const showWindowOnReady =
    !action || !isBackgroundFeedBridgeDeepLinkAction(action);

  return { showWindowOnReady };
}

/**
 * @param {import('./deepLinks.js').DeepLinkAction} action
 */
function dispatchDeepLinkAction(action) {
  if (
    isFeedLabBridgeDeepLinkAction(action) &&
    !isFeedLabProtocolBridgeEnabled()
  ) {
    sendDeepLinkError(FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE);
    return;
  }

  sendDeepLinkActionRequest(action);
}

/**
 * @param {import('./deepLinks.js').DeepLinkAction} action
 */
function sendDeepLinkActionRequest(action) {
  if (isBackgroundFeedBridgeDeepLinkAction(action)) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow({ showOnReady: false });
    }
  } else {
    showMainWindow();
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLinkAction = action;
    return;
  }

  if (!mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('deep-link:action-request', action);
    return;
  }

  pendingDeepLinkAction = action;
}

function flushPendingDeepLinkAction() {
  if (!pendingDeepLinkAction || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(
    'deep-link:action-request',
    pendingDeepLinkAction,
  );
}

function consumePendingDeepLinkAction() {
  const action = pendingDeepLinkAction;
  pendingDeepLinkAction = null;
  return action;
}

/**
 * @param {string} message
 */
function sendDeepLinkError(message) {
  showMainWindow();

  const payload = { message };

  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLinkError = payload;
    return;
  }

  if (!mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('deep-link:error', payload);
    return;
  }

  pendingDeepLinkError = payload;
}

function flushPendingDeepLinkError() {
  if (!pendingDeepLinkError || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('deep-link:error', pendingDeepLinkError);
  pendingDeepLinkError = null;
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

function resolveExternalFilePath(filePath) {
  return path.resolve(filePath);
}

function enqueueExternalFiles(filePaths) {
  for (const filePath of filePaths) {
    let resolved;
    try {
      resolved = resolveExternalFilePath(filePath);
    } catch {
      continue;
    }

    if (!externalFileQueue.includes(resolved)) {
      externalFileQueue.push(resolved);
    }
  }
}

function assertExternalFileInQueue(resolved) {
  if (!externalFileQueue.includes(resolved)) {
    throw new Error('External file is not pending.');
  }
}

function dequeueExternalFile(filePath) {
  const resolved = resolveExternalFilePath(filePath);
  const index = externalFileQueue.indexOf(resolved);
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
    createWindow({ showOnReady: true });
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function ensureMainWindowHidden() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow({ showOnReady: false });
  }
}

async function readExternalFileText(resolved) {
  assertAllowedExternalFile(resolved);
  const text = await fsPromises.readFile(resolved, 'utf8');

  if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_JSON_FILE_BYTES) {
    throw new Error(
      `File exceeds the maximum allowed size (${Math.floor(MAX_IMPORT_JSON_FILE_BYTES / (1024 * 1024))} MB).`,
    );
  }

  return text;
}

async function sendExternalFileOpened(filePath) {
  showMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const resolved = resolveExternalFilePath(filePath);
  /** @type {Record<string, unknown>} */
  let payload;

  try {
    assertExternalFileInQueue(resolved);
    const metadata = getExternalFileMetadata(resolved);
    const text = await readExternalFileText(resolved);
    payload = { ...metadata, text };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to read file.';
    let metadata;
    try {
      metadata = getExternalFileMetadata(resolved);
    } catch {
      metadata = {
        path: resolved,
        name: path.basename(resolved),
        size: 0,
      };
    }
    payload = { ...metadata, error: message };
  }

  mainWindow.webContents.send('external-file:opened', payload);
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
  ensureMainWindowHidden();

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

function requestTrayEncryptCopiedMessage(username) {
  if (!trayIsLoggedIn) {
    return;
  }

  const plaintext = clipboard.readText();

  if (!plaintext.trim()) {
    sendTrayEncryptCopiedMessage({
      username,
      error: 'Clipboard is empty.',
    });
    return;
  }

  sendTrayEncryptCopiedMessage({
    username,
    plaintext,
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

function getAppIconPath() {
  const electronIcon = path.join(__dirname, 'icon.png');
  if (fs.existsSync(electronIcon)) {
    return electronIcon;
  }

  const distIcon = path.join(__dirname, '../dist/favicon.ico');
  if (fs.existsSync(distIcon)) {
    return distIcon;
  }

  return path.join(__dirname, '../public/favicon.ico');
}

function getAppIconImage() {
  const iconPath = getAppIconPath();
  let image = nativeImage.createFromPath(iconPath);

  if (image.isEmpty()) {
    image = nativeImage.createFromBuffer(fs.readFileSync(iconPath));
  }

  return image;
}

function getTrayIconPath(variant = 'default') {
  const baseName = variant === 'success' ? 'tray-icon-success' : 'tray-icon';

  if (process.platform === 'win32') {
    return path.join(__dirname, `${baseName}.ico`);
  }

  return path.join(__dirname, `${baseName}.png`);
}

function getLinuxTrayIconSize() {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
  return Math.round(LINUX_TRAY_ICON_SIZE * scaleFactor);
}

function createTrayImage(iconPath) {
  // Let Windows pick the best embedded ICO frame instead of pre-rasterizing.
  if (process.platform === 'win32') {
    return iconPath;
  }

  let image = nativeImage.createFromPath(iconPath);

  if (process.platform === 'linux') {
    const size = getLinuxTrayIconSize();
    const { width, height } = image.getSize();
    if (width !== size || height !== size) {
      image = image.resize({ width: size, height: size, quality: 'best' });
    }
  }

  return image;
}

function createTrayIcon() {
  return createTrayImage(getTrayIconPath());
}

function createTraySuccessIcon() {
  return createTrayImage(getTrayIconPath('success'));
}

function flashTraySuccessIcon(durationMs = TRAY_SUCCESS_ICON_DURATION_MS) {
  if (!tray) {
    return;
  }

  if (traySuccessIconTimeout) {
    clearTimeout(traySuccessIconTimeout);
    traySuccessIconTimeout = null;
  }

  tray.setImage(createTraySuccessIcon());
  tray.setToolTip(TRAY_TOOLTIP_SUCCESS);

  traySuccessIconTimeout = setTimeout(() => {
    traySuccessIconTimeout = null;
    if (!tray) {
      return;
    }

    tray.setImage(createTrayIcon());
    tray.setToolTip(TRAY_TOOLTIP_DEFAULT);
  }, durationMs);
}

function copyTrayPublicKeyToClipboard() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('tray:copy-public-key');
      return;
    }

    pendingTrayCopyPublicKey = true;
    return;
  }

  if (trayPublicKeyText) {
    clipboard.writeText(trayPublicKeyText);
    flashTraySuccessIcon();
  }
}

function flushPendingTrayCopyPublicKey() {
  if (!pendingTrayCopyPublicKey || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  pendingTrayCopyPublicKey = false;
  mainWindow.webContents.send('tray:copy-public-key');
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
        copyTrayPublicKeyToClipboard();
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
        requestGracefulQuit();
      },
    },
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  tray = new Tray(createTrayIcon());
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

function createWindow({ showOnReady = true } = {}) {
  const windowIcon =
    process.platform === 'linux' ? getAppIconImage() : getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Feed-lab op-quick must run while the window is hidden (tray).
      backgroundThrottling: false,
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
    flushPendingTrayCopyPublicKey();
    flushPendingDeepLinkAction();
    flushPendingDeepLinkError();
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

ipcMain.handle('clipboard:write-text', (_event, text) => {
  if (typeof text !== 'string') {
    throw new Error('Clipboard text must be a string.');
  }

  clipboard.writeText(text);
});

function assertPrivateKeyIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window is not available.');
  }

  if (event.sender !== mainWindow.webContents) {
    throw new Error('Request is not allowed from this context.');
  }
}

ipcMain.handle('private-key:pick-from-dialog', async (event) => {
  assertPrivateKeyIpcSender(event);
  assertPrivateKeySafeStoragePickFromDialog();
  return pickPrivateKeyJwkTextFromDialog();
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

ipcMain.handle('window:show', () => {
  showMainWindow();
});

ipcMain.handle('window:hide', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});

ipcMain.handle('window:is-visible', () => {
  return Boolean(
    mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible(),
  );
});

ipcMain.handle('shell:open-external', async (event, url, options = {}) => {
  assertPrivateKeyIpcSender(event);
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('URL is required.');
  }

  const validationError = validateFeedLabOpenExternalUrl(url);
  if (validationError) {
    throw new Error(validationError);
  }

  const externalOptions = {};
  if (options?.background === true && process.platform === 'darwin') {
    externalOptions.activate = false;
  }

  await shell.openExternal(url.trim(), externalOptions);
});

ipcMain.handle('deep-link:consume-pending-action', () => {
  return consumePendingDeepLinkAction();
});

ipcMain.handle('protocol:get-handler-status', () => {
  return getProtocolHandlerStatus();
});

ipcMain.handle('protocol:restore-default-handler', () => {
  return restoreDefaultProtocolHandler();
});

ipcMain.handle('tray:flash-success', () => {
  flashTraySuccessIcon();
});

ipcMain.handle('external-file:consume', (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('External file path must be a non-empty string.');
  }

  const resolved = resolveExternalFilePath(filePath);
  assertExternalFileInQueue(resolved);
  dequeueExternalFile(resolved);
  flushExternalFileQueue();
});

ipcMain.on('tray:set-auth-state', (_event, state) => {
  if (typeof state?.canExportPublicKey === 'boolean') {
    trayCanExportPublicKey = state.canExportPublicKey;
  }
  if (typeof state?.isLoggedIn === 'boolean') {
    trayIsLoggedIn = state.isLoggedIn;
  }
  if (state?.publicKeyText !== undefined) {
    trayPublicKeyText =
      typeof state.publicKeyText === 'string' ? state.publicKeyText : null;
  }

  const authPatch = {};
  if (typeof state?.isLoggedIn === 'boolean') {
    authPatch.isLoggedIn = state.isLoggedIn;
  }
  if (state?.keyId !== undefined) {
    authPatch.keyId = typeof state.keyId === 'string' ? state.keyId : null;
  }
  if (Object.keys(authPatch).length > 0) {
    setPrivateKeySafeStorageAuthState(authPatch);
  }

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
  if (!app.isPackaged) {
    registerDefaultProtocolClient();
  }

  configureContentSecurityPolicy();
  blockRemoteNetworkRequests();

  const { showWindowOnReady } = runStartupLaunch();

  createTray();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow({ showOnReady: showWindowOnReady });
  }

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

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  enqueueExternalFiles([filePath]);
  flushExternalFileQueue();
});
