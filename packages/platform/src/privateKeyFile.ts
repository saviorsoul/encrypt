import {
  ELECTRON_STORED_KEY_UNLOCK_FAILED,
  hasPlatformSafeStorageBridge,
  hasElectronStoredPrivateKey,
  importElectronPrivateKeyForAccount,
  loadPrivateKeyJwkFromElectronSafeStorage,
} from './electronSafeStoragePrivateKey.ts';
import { getActivePrivateKeyId } from './activePrivateKeyId.ts';
import {
  FILE_SELECTION_CANCELLED,
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkInElectronNativeDialog,
} from './privateKeyJwkPickers.ts';
import { isElectronApp } from './isElectronApp.ts';
import { readPrivateKeyJwkFromText } from './privateKeyJwkText.ts';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from './sessionPrivateKeyStorage.ts';
import {
  importUploadedPrivateKeyMaterial,
  isPrivateKeyMismatchError,
  type UploadedPrivateKeyMaterial,
} from '@encrypt/core/crypto/privateKeyMaterial';

export type { PickedPrivateKeyJwkFile } from './privateKeyJwkPickers.ts';
export {
  FILE_SELECTION_CANCELLED,
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkFileWithName,
  pickPrivateKeyJwkInElectronNativeDialog,
} from './privateKeyJwkPickers.ts';

export type { ParsePrivateKeyJwkResult } from './privateKeyJwkText.ts';
export {
  parsePrivateKeyJwkText,
  readPrivateKeyJwkFromText,
} from './privateKeyJwkText.ts';

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

export async function withUploadedPrivateKey<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  const cached = getCachedPrivateKeyMaterial();
  if (cached) {
    return runWithCachedPrivateKeyMaterial(cached, fn);
  }

  if (hasPlatformSafeStorageBridge()) {
    const keyId = getActivePrivateKeyId();
    if (!keyId) {
      throw new Error('Sign in and wait for your public key to load.');
    }
    return withElectronSafeStoragePrivateKey(fn, keyId);
  }

  return withWebPrivateKeyFile(fn);
}

export async function importPlatformPrivateKeyFromFile(
  keyId: string,
): Promise<void> {
  const jwk =
    isElectronApp() && hasPlatformSafeStorageBridge()
      ? await pickPrivateKeyJwkInElectronNativeDialog()
      : await pickPrivateKeyJwkFile();
  await importElectronPrivateKeyForAccount(keyId, jwk);
}

export async function importElectronPrivateKeyFromFile(
  keyId: string,
): Promise<void> {
  await importPlatformPrivateKeyFromFile(keyId);
}
