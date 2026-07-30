import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as electronSafeStoragePrivateKey from '@/crypto/electronSafeStoragePrivateKey.ts';
import {
  PrivateKeyMismatchError,
  type UploadedPrivateKeyMaterial,
} from '@/crypto/privateKeyMaterial.ts';
import * as privateKeyMaterial from '@/crypto/privateKeyMaterial.ts';
import * as privateKeyJwkPickers from '@/crypto/privateKeyJwkPickers.ts';
import { withUploadedPrivateKey } from '@/crypto/privateKeyFile.ts';
import {
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import { setSessionPrivateKeyStorageEnabled } from '@/utils/sessionPrivateKeyPreference.ts';

const testMaterial = {
  keyId: 'test-key-id',
  publicKey: { x: 'x', y: 'y' },
  ecdhPrivateKey: {} as CryptoKey,
  ecdsaSignPrivateKey: {} as CryptoKey,
  senderPublicKey: {} as CryptoKey,
} satisfies UploadedPrivateKeyMaterial;

describe('withUploadedPrivateKey', () => {
  beforeEach(() => {
    setSessionPrivateKeyStorageEnabled(true);
    clearSessionPrivateKeyStorage();
    vi.restoreAllMocks();
    vi.spyOn(
      electronSafeStoragePrivateKey,
      'hasPlatformSafeStorageBridge',
    ).mockReturnValue(false);
    vi.spyOn(privateKeyJwkPickers, 'pickPrivateKeyJwkFile').mockResolvedValue(
      {},
    );
  });

  it('does not cache a key when the operation fails with a mismatch error', async () => {
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);

    await expect(
      withUploadedPrivateKey(async () => {
        throw new PrivateKeyMismatchError('wrong key');
      }),
    ).rejects.toThrow('wrong key');

    expect(getCachedPrivateKeyMaterial()).toBeNull();
  });

  it('caches a key only after the operation succeeds', async () => {
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);

    await withUploadedPrivateKey(async () => 'ok');

    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
  });

  it('clears a mismatched cached key so the user can pick again', async () => {
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);
    clearSessionPrivateKeyStorage();
    await withUploadedPrivateKey(async () => 'ok');
    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);

    await expect(
      withUploadedPrivateKey(async () => {
        throw new PrivateKeyMismatchError('wrong key');
      }),
    ).rejects.toThrow('wrong key');

    expect(getCachedPrivateKeyMaterial()).toBeNull();
  });

  it('keeps a cached key when a non-mismatch operation fails', async () => {
    vi.spyOn(
      privateKeyMaterial,
      'importUploadedPrivateKeyMaterial',
    ).mockResolvedValue(testMaterial);
    clearSessionPrivateKeyStorage();
    await withUploadedPrivateKey(async () => 'ok');

    await expect(
      withUploadedPrivateKey(async () => {
        throw new Error('network error');
      }),
    ).rejects.toThrow('network error');

    expect(getCachedPrivateKeyMaterial()).toEqual(testMaterial);
  });
});
