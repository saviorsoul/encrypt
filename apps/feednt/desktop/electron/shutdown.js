/**
 * @typedef {object} AppQuitState
 * @property {boolean} isQuitting
 * @property {{ destroy: () => void } | null} tray
 * @property {NodeJS.Timeout | null} traySuccessIconTimeout
 * @property {{ isDestroyed: () => boolean; destroy: () => void } | null} mainWindow
 */

/**
 * Releases tray, window, and pending timers before Electron exits.
 *
 * @param {AppQuitState} state
 * @returns {AppQuitState}
 */
export function prepareAppForQuit(state) {
  if (state.traySuccessIconTimeout) {
    clearTimeout(state.traySuccessIconTimeout);
  }

  if (state.tray) {
    state.tray.destroy();
  }

  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.destroy();
  }

  return {
    isQuitting: true,
    tray: null,
    traySuccessIconTimeout: null,
    mainWindow: null,
  };
}

/**
 * Registers OS shutdown signals so systemd/logind can exit the app gracefully.
 *
 * @param {{
 *   process: NodeJS.Process;
 *   platform?: NodeJS.Platform;
 *   onShutdownSignal: () => void;
 * }} deps
 */
export function registerShutdownSignalHandlers(deps) {
  const platform = deps.platform ?? deps.process.platform;
  if (platform === 'win32') {
    return;
  }

  const handler = () => {
    deps.onShutdownSignal();
  };

  deps.process.on('SIGTERM', handler);
  deps.process.on('SIGINT', handler);
}

/**
 * Registers Electron powerMonitor shutdown for Linux/macOS system power-off.
 *
 * @param {{
 *   powerMonitor: { on: (event: 'shutdown', listener: () => void) => void };
 *   process: NodeJS.Process;
 *   platform?: NodeJS.Platform;
 *   onShutdownSignal: () => void;
 * }} deps
 */
export function registerPowerMonitorShutdownHandler(deps) {
  const platform = deps.platform ?? deps.process.platform;
  if (platform !== 'linux' && platform !== 'darwin') {
    return;
  }

  deps.powerMonitor.on('shutdown', () => {
    deps.onShutdownSignal();
  });
}

/**
 * Registers Windows session-end handling on the main BrowserWindow.
 *
 * On Windows, `before-quit` is not emitted during system shutdown or logoff, so
 * cleanup must run from `query-session-end` instead.
 *
 * @param {{
 *   window: {
 *     on: (
 *       event: 'query-session-end',
 *       listener: (event: { preventDefault: () => void }) => void,
 *     ) => void;
 *   };
 *   process: NodeJS.Process;
 *   platform?: NodeJS.Platform;
 *   onSystemSessionEnd: () => void;
 * }} deps
 */
export function registerWindowsSessionEndHandler(deps) {
  const platform = deps.platform ?? deps.process.platform;
  if (platform !== 'win32') {
    return;
  }

  deps.window.on('query-session-end', () => {
    deps.onSystemSessionEnd();
  });
}
