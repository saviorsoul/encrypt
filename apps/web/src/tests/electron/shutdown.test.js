import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  prepareAppForQuit,
  registerPowerMonitorShutdownHandler,
  registerShutdownSignalHandlers,
  registerWindowsSessionEndHandler,
} from '../../../electron/shutdown.js';

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const mainJs = fs.readFileSync(path.join(webRoot, 'electron/main.js'), 'utf8');

describe('prepareAppForQuit', () => {
  it('clears the tray success timeout', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const timeout = setTimeout(() => {}, 60_000);

    prepareAppForQuit({
      isQuitting: false,
      tray: null,
      traySuccessIconTimeout: timeout,
      mainWindow: null,
    });

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeout);
    clearTimeoutSpy.mockRestore();
  });

  it('destroys the tray and main window', () => {
    const tray = { destroy: vi.fn() };
    const mainWindow = {
      isDestroyed: () => false,
      destroy: vi.fn(),
    };

    const next = prepareAppForQuit({
      isQuitting: false,
      tray,
      traySuccessIconTimeout: null,
      mainWindow,
    });

    expect(tray.destroy).toHaveBeenCalledOnce();
    expect(mainWindow.destroy).toHaveBeenCalledOnce();
    expect(next).toEqual({
      isQuitting: true,
      tray: null,
      traySuccessIconTimeout: null,
      mainWindow: null,
    });
  });

  it('skips destroying an already destroyed window', () => {
    const mainWindow = {
      isDestroyed: () => true,
      destroy: vi.fn(),
    };

    prepareAppForQuit({
      isQuitting: false,
      tray: null,
      traySuccessIconTimeout: null,
      mainWindow,
    });

    expect(mainWindow.destroy).not.toHaveBeenCalled();
  });

  it('is safe when tray and window are already null', () => {
    expect(
      prepareAppForQuit({
        isQuitting: false,
        tray: null,
        traySuccessIconTimeout: null,
        mainWindow: null,
      }),
    ).toEqual({
      isQuitting: true,
      tray: null,
      traySuccessIconTimeout: null,
      mainWindow: null,
    });
  });
});

describe('registerShutdownSignalHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers SIGTERM and SIGINT on Linux', () => {
    const listeners = new Map();
    const process = {
      platform: 'linux',
      on(signal, handler) {
        listeners.set(signal, handler);
      },
    };
    const onShutdownSignal = vi.fn();

    registerShutdownSignalHandlers({
      process,
      platform: 'linux',
      onShutdownSignal,
    });

    listeners.get('SIGTERM')?.();
    listeners.get('SIGINT')?.();

    expect(onShutdownSignal).toHaveBeenCalledTimes(2);
  });

  it('does not register handlers on Windows', () => {
    const on = vi.fn();

    registerShutdownSignalHandlers({
      process: { platform: 'win32', on },
      platform: 'win32',
      onShutdownSignal: vi.fn(),
    });

    expect(on).not.toHaveBeenCalled();
  });
});

describe('registerPowerMonitorShutdownHandler', () => {
  it('registers shutdown on macOS', () => {
    let shutdownHandler = () => {};
    const powerMonitor = {
      on(event, handler) {
        expect(event).toBe('shutdown');
        shutdownHandler = handler;
      },
    };
    const onShutdownSignal = vi.fn();

    registerPowerMonitorShutdownHandler({
      powerMonitor,
      process: { platform: 'darwin' },
      platform: 'darwin',
      onShutdownSignal,
    });

    shutdownHandler();
    expect(onShutdownSignal).toHaveBeenCalledOnce();
  });

  it('registers shutdown on Linux', () => {
    let shutdownHandler = () => {};
    const powerMonitor = {
      on(event, handler) {
        expect(event).toBe('shutdown');
        shutdownHandler = handler;
      },
    };
    const onShutdownSignal = vi.fn();

    registerPowerMonitorShutdownHandler({
      powerMonitor,
      process: { platform: 'linux' },
      platform: 'linux',
      onShutdownSignal,
    });

    shutdownHandler();
    expect(onShutdownSignal).toHaveBeenCalledOnce();
  });

  it('does not register on Windows', () => {
    const on = vi.fn();

    registerPowerMonitorShutdownHandler({
      powerMonitor: { on },
      process: { platform: 'win32' },
      platform: 'win32',
      onShutdownSignal: vi.fn(),
    });

    expect(on).not.toHaveBeenCalled();
  });
});

describe('registerWindowsSessionEndHandler', () => {
  it('registers query-session-end on Windows', () => {
    let sessionEndHandler = () => {};
    const window = {
      on(event, handler) {
        expect(event).toBe('query-session-end');
        sessionEndHandler = handler;
      },
    };
    const onSystemSessionEnd = vi.fn();

    registerWindowsSessionEndHandler({
      window,
      process: { platform: 'win32' },
      platform: 'win32',
      onSystemSessionEnd,
    });

    sessionEndHandler();
    expect(onSystemSessionEnd).toHaveBeenCalledOnce();
  });

  it('does not block shutdown when the session ends', () => {
    let sessionEndHandler = () => {};
    const preventDefault = vi.fn();
    const window = {
      on(_event, handler) {
        sessionEndHandler = handler;
      },
    };

    registerWindowsSessionEndHandler({
      window,
      process: { platform: 'win32' },
      platform: 'win32',
      onSystemSessionEnd: vi.fn(),
    });

    sessionEndHandler({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not register on Linux', () => {
    const on = vi.fn();

    registerWindowsSessionEndHandler({
      window: { on },
      process: { platform: 'linux' },
      platform: 'linux',
      onSystemSessionEnd: vi.fn(),
    });

    expect(on).not.toHaveBeenCalled();
  });
});

describe('Electron main shutdown wiring', () => {
  it('imports shutdown helpers and registers signal handlers', () => {
    expect(mainJs).toContain("from './shutdown.js'");
    expect(mainJs).toContain('prepareAppForQuit');
    expect(mainJs).toContain('registerShutdownSignalHandlers');
    expect(mainJs).toContain('registerPowerMonitorShutdownHandler');
    expect(mainJs).toContain('registerWindowsSessionEndHandler');
    expect(mainJs).toContain('powerMonitor');
    expect(mainJs).toContain("app.on('before-quit'");
  });
});
