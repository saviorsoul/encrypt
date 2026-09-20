import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePrivateKeyId } from '@/crypto/activePrivateKeyId.ts';
import * as electronSafeStoragePrivateKey from '@/crypto/electronSafeStoragePrivateKey.ts';
import * as privateKeyMaterial from '@/crypto/privateKeyMaterial.ts';
import * as privateKeyJwkPickers from '@/crypto/privateKeyJwkPickers.ts';
import { withUploadedPrivateKey } from '@/crypto/privateKeyFile.ts';
import { getCachedPrivateKeyMaterial } from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  clearWindowElectron,
  setWindowElectron,
} from '@/test/electronWindow.ts';

const testMaterial = {
  keyId: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  publicKey: { x: 'x', y: 'y' },
  ecdhPrivateKey: {} as CryptoKey,
  ecdsaSignPrivateKey: {} as CryptoKey,
  senderPublicKey: {} as CryptoKey,
};

describe('withUploadedPrivateKey (Electron safeStorage)', () => {
  const armSession = vi.fn();
  const pickPrivateKeyJwkInElectronNativeDialog = vi.fn(async () => ({
    kty: 'EC',
  }));

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    clearWindowElectron();
    armSession.mockClear();
    pickPrivateKeyJwkInElectronNativeDialog.mockClear();
    setActivePrivateKeyId(testMaterial.keyId);
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'hasPlatformSafeStorageBridge',
    ).mockReturnValue(true);
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'loadPrivateKeyJwkFromElectronSafeStorage',
    ).mockResolvedValue(null);
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'hasElectronStoredPrivateKey',
    ).mockResolvedValue(false);
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'importElectronPrivateKeyForAccount',
    ).mockResolvedValue();
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);
    vi.spyOn(
      privateKeyJwkPickers,
      'pickPrivateKeyJwkInElectronNativeDialog',
    ).mockImplementation(pickPrivateKeyJwkInElectronNativeDialog);
  });

  afterEach(() => {
    clearWindowElectron();
  });

  function enableElectronArmSessionTracking(): void {
    vi.stubEnv('VITE_ELECTRON', '1');
    setWindowElectron({
      privateKeySafeStorage: {
        armSession,
      },
    });
  }

  it('requires the active logged-in key id on Electron', async () => {
    setActivePrivateKeyId(null);

    await expect(withUploadedPrivateKey(async () => 'ok')).rejects.toThrow(
      'Sign in and wait for your public key to load.',
    );
  });

  it('loads from safeStorage without opening the file picker', async () => {
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'loadPrivateKeyJwkFromElectronSafeStorage',
    ).mockResolvedValue({ kty: 'EC' });

    await withUploadedPrivateKey(async () => 'ok');

    expect(pickPrivateKeyJwkInElectronNativeDialog).not.toHaveBeenCalled();
    expect(
      electronSafeStoragePrivateKey.importElectronPrivateKeyForAccount,
    ).not.toHaveBeenCalled();
  });

  it('opens the file picker only when the account key is not stored yet', async () => {
    await withUploadedPrivateKey(async () => 'ok');

    expect(pickPrivateKeyJwkInElectronNativeDialog).toHaveBeenCalledTimes(1);
    expect(
      electronSafeStoragePrivateKey.importElectronPrivateKeyForAccount,
    ).toHaveBeenCalled();
  });

  it('does not open the file picker when safeStorage unlock fails', async () => {
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'hasElectronStoredPrivateKey',
    ).mockResolvedValue(true);

    await expect(withUploadedPrivateKey(async () => 'ok')).rejects.toThrow(
      'Could not unlock your private key from the OS keychain.',
    );

    expect(pickPrivateKeyJwkInElectronNativeDialog).not.toHaveBeenCalled();
  });

  it('arms the keychain session after caching a key loaded from safeStorage', async () => {
    enableElectronArmSessionTracking();
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'loadPrivateKeyJwkFromElectronSafeStorage',
    ).mockResolvedValue({ kty: 'EC' });

    await withUploadedPrivateKey(async () => 'ok');

    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
    expect(armSession).toHaveBeenCalledWith(testMaterial.keyId);
  });

  it('does not open the file picker when the keychain session is locked', async () => {
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'loadPrivateKeyJwkFromElectronSafeStorage',
    ).mockRejectedValue(
      new Error(electronSafeStoragePrivateKey.ELECTRON_KEYCHAIN_LOCKED),
    );

    await expect(withUploadedPrivateKey(async () => 'ok')).rejects.toThrow(
      electronSafeStoragePrivateKey.ELECTRON_KEYCHAIN_LOCKED,
    );

    expect(pickPrivateKeyJwkInElectronNativeDialog).not.toHaveBeenCalled();
  });
});
