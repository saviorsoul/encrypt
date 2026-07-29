import {
  ELECTRON_STORED_KEY_UNLOCK_FAILED,
  hasElectronSafeStorageBridge,
  hasElectronStoredPrivateKey,
  importElectronPrivateKeyForAccount,
  loadPrivateKeyJwkFromElectronSafeStorage,
} from '@/crypto/electronSafeStoragePrivateKey.ts';
import { getActivePrivateKeyId } from '@/crypto/activePrivateKeyId.ts';
import {
  FILE_SELECTION_CANCELLED,
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkInElectronNativeDialog,
} from '@/crypto/privateKeyJwkPickers.ts';
import { readPrivateKeyJwkFromText } from '@/crypto/privateKeyJwkText.ts';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  importUploadedPrivateKeyMaterial,
  isPrivateKeyMismatchError,
  type UploadedPrivateKeyMaterial,
} from '@/crypto/privateKeyMaterial.ts';

export type { PickedPrivateKeyJwkFile } from '@/crypto/privateKeyJwkPickers.ts';
export {
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkFileWithName,
  pickPrivateKeyJwkInElectronNativeDialog,
} from '@/crypto/privateKeyJwkPickers.ts';

export type { ParsePrivateKeyJwkResult } from '@/crypto/privateKeyJwkText.ts';
export {
  parsePrivateKeyJwkText,
  readPrivateKeyJwkFromText,
} from '@/crypto/privateKeyJwkText.ts';

export async function readPrivateKeyJwkFromFile(
  file: File,
): Promise<JsonWebKey> {
  const text = await file.text();
  return readPrivateKeyJwkFromText(text);
}

export function isPrivateKeyFileSelectionCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === FILE_SELECTION_CANCELLED;
}

async function runWithCachedPrivateKeyMaterial<T>(
  material: UploadedPrivateKeyMaterial,
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  try {
    return await fn(material);
  } catch (error) {
    if (isPrivateKeyMismatchError(error)) {
      clearSessionPrivateKeyStorage();
    }
    throw error;
  }
}

async function runWithImportedPrivateKeyMaterial<T>(
  material: UploadedPrivateKeyMaterial,
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  try {
    const result = await fn(material);
    cachePrivateKeyMaterial(material);
    return result;
  } catch (error) {
    if (isPrivateKeyMismatchError(error)) {
      clearSessionPrivateKeyStorage();
    }
    throw error;
  }
}

async function withElectronSafeStoragePrivateKey<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
  keyId: string,
): Promise<T> {
  const storedJwk = await loadPrivateKeyJwkFromElectronSafeStorage(keyId);
  if (storedJwk) {
    const material = await importUploadedPrivateKeyMaterial(storedJwk);
    return runWithImportedPrivateKeyMaterial(material, fn);
  }

  const hasStored = await hasElectronStoredPrivateKey(keyId);
  if (hasStored) {
    throw new Error(ELECTRON_STORED_KEY_UNLOCK_FAILED);
  }

  const jwk = await pickPrivateKeyJwkInElectronNativeDialog();
  await importElectronPrivateKeyForAccount(keyId, jwk);
  const material = await importUploadedPrivateKeyMaterial(jwk);
  return runWithImportedPrivateKeyMaterial(material, fn);
}

async function withWebPrivateKeyFile<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  const jwk = await pickPrivateKeyJwkFile();
  const material = await importUploadedPrivateKeyMaterial(jwk);
  return runWithImportedPrivateKeyMaterial(material, fn);
}

/**
 * Run a crypto operation with the user's private key.
 * Electron: safeStorage is the only source after first import for an account.
 * Web: in-memory cache when enabled, otherwise file picker each time.
 */
export async function withUploadedPrivateKey<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  const cached = getCachedPrivateKeyMaterial();
  if (cached) {
    return runWithCachedPrivateKeyMaterial(cached, fn);
  }

  if (hasElectronSafeStorageBridge()) {
    const keyId = getActivePrivateKeyId();
    if (!keyId) {
      throw new Error('Sign in and wait for your public key to load.');
    }
    return withElectronSafeStoragePrivateKey(fn, keyId);
  }

  return withWebPrivateKeyFile(fn);
}

/**
 * Import a private key file for the current Electron account and store it in
 * safeStorage. Used on first login for an account on this device.
 */
export async function importElectronPrivateKeyFromFile(
  keyId: string,
): Promise<void> {
  const jwk = await pickPrivateKeyJwkInElectronNativeDialog();
  await importElectronPrivateKeyForAccount(keyId, jwk);
}
