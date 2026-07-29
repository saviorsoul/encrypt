import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSafeStorage = vi.hoisted(() => ({
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptString: (text) => Buffer.from(`enc:${text}`, 'utf8'),
  decryptString: (buffer) => buffer.toString('utf8').slice(4),
}));

vi.mock('electron', () => ({
  safeStorage: mockSafeStorage,
}));

import {
  BASIC_TEXT_STORAGE_BACKEND,
  clearAllStoredPrivateKeys,
  getPrivateKeyEncryptionStatus,
  hasStoredPrivateKey,
  isPrivateKeyEncryptionAvailable,
  listStoredPrivateKeyIds,
  loadPrivateKeyJwk,
  loadSoleStoredPrivateKeyJwk,
  storePrivateKeyJwk,
} from '../../../electron/safeStoragePrivateKey.js';

const TEST_KEY_ID = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const TEST_JWK_TEXT = '{"kty":"EC","crv":"P-256","x":"x","y":"y","d":"d"}';

const tempDirs = [];

function makeTempUserDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encrypt-safe-storage-'));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  mockSafeStorage.isEncryptionAvailable = () => true;
  mockSafeStorage.getSelectedStorageBackend = () => 'gnome_libsecret';
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.promises.rm(dir, { recursive: true, force: true })),
  );
});

describe('safeStoragePrivateKey', () => {
  it('reports secure encryption when a real secret store backend is selected', () => {
    expect(isPrivateKeyEncryptionAvailable()).toBe(true);
    expect(getPrivateKeyEncryptionStatus()).toEqual({
      available: true,
      backend: 'gnome_libsecret',
      reason: null,
    });
  });

  it('treats basic_text backend as unavailable even when isEncryptionAvailable is false', () => {
    mockSafeStorage.isEncryptionAvailable = () => false;
    mockSafeStorage.getSelectedStorageBackend = () => 'basic_text';

    expect(isPrivateKeyEncryptionAvailable()).toBe(false);
    expect(getPrivateKeyEncryptionStatus()).toEqual({
      available: false,
      backend: BASIC_TEXT_STORAGE_BACKEND,
      reason: 'basic_text',
    });
  });

  it('treats basic_text backend as unavailable for persistence', () => {
    mockSafeStorage.getSelectedStorageBackend = () => 'basic_text';

    expect(isPrivateKeyEncryptionAvailable()).toBe(false);
    expect(getPrivateKeyEncryptionStatus()).toEqual({
      available: false,
      backend: BASIC_TEXT_STORAGE_BACKEND,
      reason: 'basic_text',
    });
  });

  it('stores and loads a private key when encryption is available', async () => {
    const userDataPath = makeTempUserDataDir();
    await storePrivateKeyJwk(userDataPath, TEST_KEY_ID, TEST_JWK_TEXT);

    expect(await listStoredPrivateKeyIds(userDataPath)).toEqual([TEST_KEY_ID]);
    expect(await loadPrivateKeyJwk(userDataPath, TEST_KEY_ID)).toBe(
      TEST_JWK_TEXT,
    );
    expect(await loadSoleStoredPrivateKeyJwk(userDataPath)).toEqual({
      keyId: TEST_KEY_ID,
      jwkText: TEST_JWK_TEXT,
    });
  });

  it('refuses to store when basic_text backend is selected', async () => {
    mockSafeStorage.getSelectedStorageBackend = () => 'basic_text';
    const userDataPath = makeTempUserDataDir();

    await expect(
      storePrivateKeyJwk(userDataPath, TEST_KEY_ID, TEST_JWK_TEXT),
    ).rejects.toThrow('OS encryption is not available.');
  });

  it('clears all stored private keys', async () => {
    const userDataPath = makeTempUserDataDir();
    await storePrivateKeyJwk(userDataPath, TEST_KEY_ID, TEST_JWK_TEXT);
    await clearAllStoredPrivateKeys(userDataPath);

    expect(await listStoredPrivateKeyIds(userDataPath)).toEqual([]);
    expect(await loadPrivateKeyJwk(userDataPath, TEST_KEY_ID)).toBeNull();
  });

  it('rejects invalid key ids', async () => {
    const userDataPath = makeTempUserDataDir();
    await expect(
      storePrivateKeyJwk(userDataPath, '../evil', TEST_JWK_TEXT),
    ).rejects.toThrow('Invalid private key id.');
  });

  it('reports whether a key file exists without decrypting it', async () => {
    const userDataPath = makeTempUserDataDir();
    expect(hasStoredPrivateKey(userDataPath, TEST_KEY_ID)).toBe(false);
    await storePrivateKeyJwk(userDataPath, TEST_KEY_ID, TEST_JWK_TEXT);
    expect(hasStoredPrivateKey(userDataPath, TEST_KEY_ID)).toBe(true);
  });
});
