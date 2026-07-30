import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import {
  cachePrivateKeyMaterial,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import { parsePrivateKeyJwkText } from '@/crypto/privateKeyJwkText.ts';
import {
  importUploadedPrivateKeyMaterial,
  PrivateKeyMismatchError,
} from '@/crypto/privateKeyMaterial.ts';
import { isCapacitorApp } from '@/utils/isCapacitorApp.ts';
import { isElectronApp } from '@/utils/isElectronApp.ts';
import type { PrivateKeySafeStorageStatus } from '@/vite-env.d.ts';
import {
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
} from '@/crypto/privateKeySafeStorageSessionErrors.ts';

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

function getPrivateKeySafeStorageBridge():
  | NonNullable<Window['electron']>['privateKeySafeStorage']
  | NonNullable<Window['capacitorBridge']>['privateKeySafeStorage']
  | null {
  if (isElectronApp() && window.electron?.privateKeySafeStorage) {
    return window.electron.privateKeySafeStorage;
  }

  if (isCapacitorApp() && window.capacitorBridge?.privateKeySafeStorage) {
    return window.capacitorBridge.privateKeySafeStorage;
  }

  return null;
}

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

function syncPlatformLoggedInKeySession(keyId: string): void {
  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  if (isElectronApp() && window.electron) {
    window.electron.setTrayAuthState({
      canExportPublicKey: false,
      publicKeyText: null,
      isLoggedIn: true,
      keyId,
    });
    return;
  }

  window.capacitorBridge?.setAuthState({
    isLoggedIn: true,
    keyId,
  });
}

/**
 * Persist a private key to safeStorage during private-key sign-in, before navigation.
 * Syncs main-process session state so keychain IPC is available immediately.
 */
export async function registerElectronPrivateKeyOnLogin(
  jwk: JsonWebKey,
): Promise<void> {
  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  const material = await importUploadedPrivateKeyMaterial(jwk);
  syncPlatformLoggedInKeySession(material.keyId);
  await registerElectronPrivateKey(jwk);
}

/** Persist a private key to safeStorage and warm the in-memory cache. */
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
