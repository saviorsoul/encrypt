import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyMemory,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import { setSessionPrivateKeyStorageEnabled } from '@/utils/sessionPrivateKeyPreference.ts';
import { setWindowElectron } from '@/test/electronWindow.ts';

const testMaterial = {
  keyId: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  publicKey: { x: 'x', y: 'y' },
  ecdhPrivateKey: {} as CryptoKey,
  ecdsaSignPrivateKey: {} as CryptoKey,
  senderPublicKey: {} as CryptoKey,
};

const clearElectronSafeStoragePrivateKeys = vi.hoisted(() => vi.fn());

vi.mock('@/crypto/electronSafeStoragePrivateKey.ts', () => ({
  clearElectronSafeStoragePrivateKeys,
}));

describe('sessionPrivateKeyStorage', () => {
  beforeEach(() => {
    clearElectronSafeStoragePrivateKeys.mockClear();
    setSessionPrivateKeyStorageEnabled(true);
    clearSessionPrivateKeyMemory();
  });

  afterEach(() => {
    clearSessionPrivateKeyStorage();
  });

  it('clears only memory when asked to drop the session cache', () => {
    clearSessionPrivateKeyMemory();
    expect(clearElectronSafeStoragePrivateKeys).not.toHaveBeenCalled();
  });

  it('clears memory and persisted keys on full storage clear', () => {
    clearSessionPrivateKeyStorage();
    expect(getCachedPrivateKeyMaterial()).toBeNull();
    expect(clearElectronSafeStoragePrivateKeys).toHaveBeenCalledTimes(1);
  });

  it('does not delete persisted keys when only clearing session memory', () => {
    clearSessionPrivateKeyMemory();
    expect(clearElectronSafeStoragePrivateKeys).not.toHaveBeenCalled();
  });

  it('arms the Electron keychain session when caching private key material', () => {
    vi.stubEnv('VITE_ELECTRON', '1');
    const armSession = vi.fn();
    setWindowElectron({
      privateKeySafeStorage: {
        armSession,
      },
    });

    cachePrivateKeyMaterial(testMaterial);

    expect(armSession).toHaveBeenCalledWith(testMaterial.keyId);
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
  });
});
