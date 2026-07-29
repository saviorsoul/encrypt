import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as privateKeyMaterial from '@/crypto/privateKeyMaterial.ts';
import {
  ELECTRON_KEYCHAIN_LOCKED,
  registerElectronPrivateKey,
  registerElectronPrivateKeyOnLogin,
} from '@/crypto/electronSafeStoragePrivateKey.ts';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyMemory,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  clearWindowElectron,
  setWindowElectron,
} from '@/test/electronWindow.ts';

const testJwk = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', d: 'd' };
const testMaterial = {
  keyId: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  publicKey: { x: 'x', y: 'y' },
  ecdhPrivateKey: {} as CryptoKey,
  ecdsaSignPrivateKey: {} as CryptoKey,
  senderPublicKey: {} as CryptoKey,
};

describe('registerElectronPrivateKey', () => {
  const store = vi.fn();
  const has = vi.fn();
  const beginSession = vi.fn();
  const armSession = vi.fn();
  const setTrayAuthState = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    clearSessionPrivateKeyMemory();
    vi.stubEnv('VITE_ELECTRON', '1');
    store.mockReset();
    has.mockReset();
    beginSession.mockReset();
    armSession.mockReset();
    setTrayAuthState.mockReset();
    setWindowElectron({
      setTrayAuthState,
      privateKeySafeStorage: {
        getStatus: async () => ({
          available: true,
          backend: 'gnome_libsecret',
          reason: null,
        }),
        beginSession,
        store,
        has,
        load: async () => null,
        armSession,
        clearAllForCleanLocalData: async () => {},
      },
    });
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);
  });

  afterEach(() => {
    clearWindowElectron();
  });

  it('skips safeStorage store when the key is already cached', async () => {
    cachePrivateKeyMaterial(testMaterial);

    await registerElectronPrivateKey(testJwk);

    expect(store).not.toHaveBeenCalled();
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
  });

  it('skips safeStorage store when the key is already on disk', async () => {
    has.mockResolvedValue(true);

    await registerElectronPrivateKey(testJwk);

    expect(store).not.toHaveBeenCalled();
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
    expect(armSession).toHaveBeenCalledWith(testMaterial.keyId);
  });

  it('warms cache without store when keychain IPC is already locked', async () => {
    has.mockRejectedValue(new Error(ELECTRON_KEYCHAIN_LOCKED));

    await registerElectronPrivateKey(testJwk);

    expect(store).not.toHaveBeenCalled();
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
    expect(armSession).toHaveBeenCalledWith(testMaterial.keyId);
  });

  it('stores to safeStorage on first registration', async () => {
    has.mockResolvedValue(false);

    await registerElectronPrivateKey(testJwk);

    expect(store).toHaveBeenCalledTimes(1);
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
  });
});

describe('registerElectronPrivateKeyOnLogin', () => {
  const store = vi.fn();
  const has = vi.fn();
  const setTrayAuthState = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    clearSessionPrivateKeyMemory();
    vi.stubEnv('VITE_ELECTRON', '1');
    store.mockReset();
    has.mockResolvedValue(false);
    setTrayAuthState.mockReset();
    setWindowElectron({
      setTrayAuthState,
      privateKeySafeStorage: {
        getStatus: async () => ({
          available: true,
          backend: 'gnome_libsecret',
          reason: null,
        }),
        beginSession: vi.fn(),
        store,
        has,
        load: async () => null,
        armSession: vi.fn(),
        clearAllForCleanLocalData: async () => {},
      },
    });
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);
  });

  afterEach(() => {
    clearWindowElectron();
  });

  it('syncs tray auth and stores the key during sign-in', async () => {
    await registerElectronPrivateKeyOnLogin(testJwk);

    expect(setTrayAuthState).toHaveBeenCalledWith({
      canExportPublicKey: false,
      publicKeyText: null,
      isLoggedIn: true,
      keyId: testMaterial.keyId,
    });
    expect(store).toHaveBeenCalledTimes(1);
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
  });
});
