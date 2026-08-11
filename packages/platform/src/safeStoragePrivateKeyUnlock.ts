import {
  importUploadedPrivateKeyMaterial,
  isPrivateKeyMismatchError,
  type UploadedPrivateKeyMaterial,
} from '@encrypt/core/crypto/privateKeyMaterial';
import { getActivePrivateKeyId } from './activePrivateKeyId.ts';
import {
  ELECTRON_STORED_KEY_UNLOCK_FAILED,
  hasPlatformSafeStorageBridge,
  isElectronKeychainLockedError,
  isElectronPrivateKeyEncryptionAvailable,
  loadPrivateKeyJwkFromElectronSafeStorage,
  registerElectronPrivateKey,
  syncPlatformSafeStorageAuthState,
  warmSessionPrivateKeyFromSafeStorage,
} from './electronSafeStoragePrivateKey.ts';
import { setActivePrivateKeyId } from './activePrivateKeyId.ts';
import {
  FILE_SELECTION_CANCELLED,
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkInElectronNativeDialog,
} from './privateKeyJwkPickers.ts';
import { isElectronApp } from './isElectronApp.ts';
import { parsePrivateKeyJwkText } from './privateKeyJwkText.ts';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyMemory,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from './sessionPrivateKeyStorage.ts';
import { getPrivateKeySafeStorageBridge } from './platformBridge.ts';
import type {
  PrivateKeySafeStorageBridge,
  StoredPrivateKeyJwkPayload,
} from './types.ts';

export const FEEDNT_REQUIRES_NATIVE_APP_MESSAGE =
  'Feednt unlock requires secure device storage. Use the Electron or mobile app.';

export const FEEDNT_NO_STORED_PRIVATE_KEY_MESSAGE =
  'No private key found in secure storage. Import a key into secure storage to continue.';

export const FEEDNT_MULTIPLE_STORED_PRIVATE_KEYS_MESSAGE =
  'Multiple private keys are stored on this device. Account selection is not available yet.';

export const FEEDNT_KEY_ALREADY_STORED_MESSAGE =
  'A private key is already stored on this device. Unlock it to continue.';

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

async function loadSolePrivateKeyFromBridge(): Promise<StoredPrivateKeyJwkPayload | null> {
  if (!hasPlatformSafeStorageBridge()) {
    return null;
  }

  const bridge = getSafeStorageDiscoveryBridge();
  if (!bridge?.loadSolePrivateKey) {
    return null;
  }

  return bridge.loadSolePrivateKey();
}

async function listPrivateKeyIdsFromBridge(): Promise<string[]> {
  if (!hasPlatformSafeStorageBridge()) {
    return [];
  }

  const bridge = getSafeStorageDiscoveryBridge();
  if (!bridge?.listPrivateKeyIds) {
    return [];
  }

  return bridge.listPrivateKeyIds();
}

function getSafeStorageDiscoveryBridge():
  | PrivateKeySafeStorageBridge
  | undefined {
  return getPrivateKeySafeStorageBridge() ?? undefined;
}

async function materialFromStoredPayload(
  payload: StoredPrivateKeyJwkPayload,
): Promise<UploadedPrivateKeyMaterial> {
  const parsed = parsePrivateKeyJwkText(payload.jwkText);
  if (!parsed.ok) {
    throw new Error('Stored private key is invalid.');
  }

  return importUploadedPrivateKeyMaterial(parsed.jwk);
}

async function pickPrivateKeyForSafeStorageImport(): Promise<JsonWebKey> {
  if (isElectronApp()) {
    try {
      return await pickPrivateKeyJwkInElectronNativeDialog();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Native private key picker is not available.'
      ) {
        return pickPrivateKeyJwkFile();
      }
      throw error;
    }
  }

  return pickPrivateKeyJwkFile();
}

export async function importPrivateKeyToSafeStorage(): Promise<UploadedPrivateKeyMaterial> {
  if (!hasPlatformSafeStorageBridge()) {
    throw new Error(FEEDNT_REQUIRES_NATIVE_APP_MESSAGE);
  }

  const encryptionAvailable = await isElectronPrivateKeyEncryptionAvailable();
  if (!encryptionAvailable) {
    throw new Error(
      'OS secure storage is not available. Unlock your system keychain and try again.',
    );
  }

  const storedKeyIds = await listPrivateKeyIdsFromBridge();
  if (storedKeyIds.length > 1) {
    throw new Error(FEEDNT_MULTIPLE_STORED_PRIVATE_KEYS_MESSAGE);
  }
  if (storedKeyIds.length === 1) {
    throw new Error(FEEDNT_KEY_ALREADY_STORED_MESSAGE);
  }

  const jwk = await pickPrivateKeyForSafeStorageImport();
  const material = await importUploadedPrivateKeyMaterial(jwk);
  syncPlatformSafeStorageAuthState(material.keyId);
  await registerElectronPrivateKey(jwk);
  setActivePrivateKeyId(material.keyId);

  const cached = getCachedPrivateKeyMaterial();
  return cached ?? material;
}

export function isPrivateKeyImportSelectionCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === FILE_SELECTION_CANCELLED;
}

export async function unlockPrivateKeyMaterialFromSafeStorage(): Promise<UploadedPrivateKeyMaterial> {
  if (!hasPlatformSafeStorageBridge()) {
    throw new Error(FEEDNT_REQUIRES_NATIVE_APP_MESSAGE);
  }

  const cached = getCachedPrivateKeyMaterial();
  if (cached) {
    return cached;
  }

  const encryptionAvailable = await isElectronPrivateKeyEncryptionAvailable();
  if (!encryptionAvailable) {
    throw new Error(
      'OS secure storage is not available. Unlock your system keychain and try again.',
    );
  }

  const activeKeyId = getActivePrivateKeyId();
  if (activeKeyId) {
    try {
      const warmed = await warmSessionPrivateKeyFromSafeStorage(activeKeyId);
      const material = getCachedPrivateKeyMaterial();
      if (warmed && material) {
        return material;
      }

      const jwk = await loadPrivateKeyJwkFromElectronSafeStorage(activeKeyId);
      if (jwk) {
        const imported = await importUploadedPrivateKeyMaterial(jwk);
        cachePrivateKeyMaterial(imported);
        return imported;
      }
    } catch (error) {
      if (!isElectronKeychainLockedError(error)) {
        throw error;
      }
      throw new Error(ELECTRON_STORED_KEY_UNLOCK_FAILED, { cause: error });
    }
  }

  const sole = await loadSolePrivateKeyFromBridge();
  if (!sole) {
    const storedKeyIds = await listPrivateKeyIdsFromBridge();
    if (storedKeyIds.length > 1) {
      throw new Error(FEEDNT_MULTIPLE_STORED_PRIVATE_KEYS_MESSAGE);
    }
    throw new Error(FEEDNT_NO_STORED_PRIVATE_KEY_MESSAGE);
  }

  const material = await materialFromStoredPayload(sole);
  cachePrivateKeyMaterial(material);
  return material;
}

export async function withSafeStoragePrivateKey<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  const material = await unlockPrivateKeyMaterialFromSafeStorage();
  return runWithCachedPrivateKeyMaterial(material, fn);
}

export function createFeedntPlatformAdapter(): import('./types.ts').PlatformAdapter {
  return {
    privateKey: {
      withUploadedPrivateKey: withSafeStoragePrivateKey,
      clearStorage: clearSessionPrivateKeyMemory,
    },
  };
}
