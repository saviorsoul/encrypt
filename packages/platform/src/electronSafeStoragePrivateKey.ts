import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import {
  importUploadedPrivateKeyMaterial,
  PrivateKeyMismatchError,
} from '@encrypt/core/crypto/privateKeyMaterial';
import type { PrivateKeySafeStorageStatus } from './types.ts';
import {
  cachePrivateKeyMaterial,
  getCachedPrivateKeyMaterial,
} from './sessionPrivateKeyStorage.ts';
import { parsePrivateKeyJwkText } from './privateKeyJwkText.ts';
import { isCapacitorApp } from './isCapacitorApp.ts';
import { isElectronApp } from './isElectronApp.ts';
import { getPrivateKeySafeStorageBridge } from './platformBridge.ts';
import { setPrivateKeySafeStorageAuthState } from './privateKeySafeStorageSession.ts';
import {
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
} from './privateKeySafeStorageSessionErrors.ts';

export {
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
};

export const ELECTRON_STORED_KEY_UNLOCK_FAILED =
  'Could not unlock your private key from the OS keychain.';

const ELECTRON_KEYCHAIN_SESSION_ERRORS = new Set([
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
]);

export function hasPlatformSafeStorageBridge(): boolean {
  return Boolean(getPrivateKeySafeStorageBridge());
}

export function isElectronKeychainSessionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ELECTRON_KEYCHAIN_SESSION_ERRORS.has(error.message)
  );
}

export function isElectronKeychainLockedError(error: unknown): boolean {
  return error instanceof Error && error.message === ELECTRON_KEYCHAIN_LOCKED;
}

export async function getElectronPrivateKeyEncryptionStatus(): Promise<PrivateKeySafeStorageStatus | null> {
  if (!hasPlatformSafeStorageBridge()) {
    return null;
  }

  return getPrivateKeySafeStorageBridge()!.getStatus();
}

export async function isElectronPrivateKeyEncryptionAvailable(): Promise<boolean> {
  const status = await getElectronPrivateKeyEncryptionStatus();
  return status?.available ?? false;
}

export async function beginElectronPrivateKeySession(
  keyId: string,
): Promise<void> {
  if (!hasPlatformSafeStorageBridge() || !keyId) {
    return;
  }

  await getPrivateKeySafeStorageBridge()!.beginSession(keyId);
}

export async function hasElectronStoredPrivateKey(
  keyId: string,
): Promise<boolean> {
  if (!hasPlatformSafeStorageBridge()) {
    return false;
  }

  await beginElectronPrivateKeySession(keyId);
  return getPrivateKeySafeStorageBridge()!.has(keyId);
}

export async function persistPrivateKeyJwkToElectronSafeStorage(
  keyId: string,
  jwk: JsonWebKey,
): Promise<void> {
  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  const available = await isElectronPrivateKeyEncryptionAvailable();
  if (!available) {
    throw new Error(
      'OS keychain is not available. Install and unlock GNOME Keyring, KWallet, or another supported secret service.',
    );
  }

  await beginElectronPrivateKeySession(keyId);
  const jwkText = JSON.stringify(slimEcPrivateJwk(jwk));
  await getPrivateKeySafeStorageBridge()!.store(keyId, jwkText);
}

export async function loadPrivateKeyJwkFromElectronSafeStorage(
  keyId: string,
): Promise<JsonWebKey | null> {
  if (!hasPlatformSafeStorageBridge() || !keyId) {
    return null;
  }

  await beginElectronPrivateKeySession(keyId);
  const result = await getPrivateKeySafeStorageBridge()!.load(keyId);
  if (!result?.jwkText) {
    return null;
  }

  const parsed = parsePrivateKeyJwkText(result.jwkText);
  if (!parsed.ok) {
    return null;
  }

  return parsed.jwk;
}

export function clearElectronSafeStoragePrivateKeys(): void {
  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  void getPrivateKeySafeStorageBridge()!.clearAllForCleanLocalData();
}

export function syncPlatformSafeStorageAuthState(keyId: string): void {
  setPrivateKeySafeStorageAuthState({ isLoggedIn: true, keyId });

  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  if (isElectronApp() && window.electron) {
    if (window.electron.setAuthState) {
      window.electron.setAuthState({ isLoggedIn: true, keyId });
      return;
    }

    window.electron.setTrayAuthState?.({
      canExportPublicKey: false,
      publicKeyText: null,
      isLoggedIn: true,
      keyId,
    });
    return;
  }

  window.capacitorBridge?.setAuthState?.({ isLoggedIn: true, keyId });
}

export async function registerElectronPrivateKey(
  jwk: JsonWebKey,
): Promise<void> {
  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  const material = await importUploadedPrivateKeyMaterial(jwk);
  const cached = getCachedPrivateKeyMaterial();
  if (cached?.keyId === material.keyId) {
    return;
  }

  let alreadyStored: boolean;
  try {
    alreadyStored = await hasElectronStoredPrivateKey(material.keyId);
  } catch (error) {
    if (isElectronKeychainLockedError(error)) {
      cachePrivateKeyMaterial(material);
      return;
    }
    throw error;
  }

  if (alreadyStored) {
    cachePrivateKeyMaterial(material);
    return;
  }

  await persistPrivateKeyJwkToElectronSafeStorage(material.keyId, jwk);
  cachePrivateKeyMaterial(material);
}

export async function importElectronPrivateKeyForAccount(
  keyId: string,
  jwk: JsonWebKey,
): Promise<void> {
  const material = await importUploadedPrivateKeyMaterial(jwk);
  if (material.keyId !== keyId) {
    throw new PrivateKeyMismatchError(
      'Selected private key does not match this account.',
    );
  }

  await registerElectronPrivateKey(jwk);
}

export async function warmSessionPrivateKeyFromSafeStorage(
  keyId: string,
): Promise<boolean> {
  if (getCachedPrivateKeyMaterial()) {
    return true;
  }

  await beginElectronPrivateKeySession(keyId);
  const hasStored = await getPrivateKeySafeStorageBridge()!.has(keyId);
  if (!hasStored) {
    return false;
  }

  const jwk = await loadPrivateKeyJwkFromElectronSafeStorage(keyId);
  if (!jwk) {
    return false;
  }

  const material = await importUploadedPrivateKeyMaterial(jwk);
  cachePrivateKeyMaterial(material);
  return true;
}
