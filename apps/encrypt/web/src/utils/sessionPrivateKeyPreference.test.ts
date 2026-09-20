import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionPrivateKeyStoragePreference,
  hasExplicitlyDisabledPrivateKeyStorage,
  initSessionPrivateKeyStoragePreference,
  isPrivateKeyMemoryCacheEnabled,
  isSessionPrivateKeyStorageEnabled,
  setSessionPrivateKeyStorageEnabled,
} from '@/utils/sessionPrivateKeyPreference.ts';
import {
  clearWindowElectron,
  setWindowElectron,
} from '@/test/electronWindow.ts';

describe('sessionPrivateKeyPreference', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_ELECTRON', '');
    clearWindowElectron();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearWindowElectron();
  });

  it('defaults to off on web when unset', () => {
    expect(initSessionPrivateKeyStoragePreference()).toBe(false);
    expect(isSessionPrivateKeyStorageEnabled()).toBe(false);
    expect(isPrivateKeyMemoryCacheEnabled()).toBe(false);
  });

  it('defaults to on in Electron when unset', () => {
    vi.stubEnv('VITE_ELECTRON', '1');
    expect(initSessionPrivateKeyStoragePreference()).toBe(true);
    expect(isSessionPrivateKeyStorageEnabled()).toBe(true);
    expect(isPrivateKeyMemoryCacheEnabled()).toBe(true);
  });

  it('enables memory cache in packaged Electron even before preference init', () => {
    setWindowElectron({
      privateKeySafeStorage: {
        getStatus: async () => ({
          available: true,
          backend: 'gnome_libsecret',
          reason: null,
        }),
        beginSession: async () => {},
        store: async () => {},
        load: async () => null,
        has: async () => false,
        armSession: async () => {},
        clearAllForCleanLocalData: async () => {},
      },
    });

    expect(isPrivateKeyMemoryCacheEnabled()).toBe(true);
  });

  it('ignores a stored off preference in Electron', () => {
    vi.stubEnv('VITE_ELECTRON', '1');
    localStorage.setItem('encrypt-session-private-key-storage-enabled', '0');

    expect(initSessionPrivateKeyStoragePreference()).toBe(true);
    expect(isSessionPrivateKeyStorageEnabled()).toBe(true);
    expect(hasExplicitlyDisabledPrivateKeyStorage()).toBe(false);
    expect(isPrivateKeyMemoryCacheEnabled()).toBe(true);
  });

  it('ignores attempts to disable storage in Electron', () => {
    vi.stubEnv('VITE_ELECTRON', '1');
    initSessionPrivateKeyStoragePreference();
    setSessionPrivateKeyStorageEnabled(false);

    expect(isSessionPrivateKeyStorageEnabled()).toBe(true);
    expect(hasExplicitlyDisabledPrivateKeyStorage()).toBe(false);
    expect(isPrivateKeyMemoryCacheEnabled()).toBe(true);
    expect(
      localStorage.getItem('encrypt-session-private-key-storage-enabled'),
    ).toBeNull();
  });

  it('restores platform defaults after clearing the preference', () => {
    vi.stubEnv('VITE_ELECTRON', '1');
    initSessionPrivateKeyStoragePreference();
    setSessionPrivateKeyStorageEnabled(false);
    clearSessionPrivateKeyStoragePreference();

    expect(isSessionPrivateKeyStorageEnabled()).toBe(true);
    expect(isPrivateKeyMemoryCacheEnabled()).toBe(true);
  });
});
