import {
  beginElectronPrivateKeySession,
  clearElectronSafeStoragePrivateKeys,
  hasElectronStoredPrivateKey,
  hasPlatformSafeStorageBridge,
  importElectronPrivateKeyForAccount,
  isElectronKeychainLockedError,
  isElectronKeychainSessionError,
  isElectronPrivateKeyEncryptionAvailable,
  loadPrivateKeyJwkFromElectronSafeStorage,
  persistPrivateKeyJwkToElectronSafeStorage,
  registerElectronPrivateKey,
  warmSessionPrivateKeyFromSafeStorage,
  ELECTRON_STORED_KEY_UNLOCK_FAILED,
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
  getElectronPrivateKeyEncryptionStatus,
} from '@encrypt/platform';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { isElectronApp } from '@encrypt/platform/isElectronApp';

export {
  beginElectronPrivateKeySession,
  clearElectronSafeStoragePrivateKeys,
  hasElectronStoredPrivateKey,
  hasPlatformSafeStorageBridge,
  importElectronPrivateKeyForAccount,
  isElectronKeychainLockedError,
  isElectronKeychainSessionError,
  isElectronPrivateKeyEncryptionAvailable,
  loadPrivateKeyJwkFromElectronSafeStorage,
  persistPrivateKeyJwkToElectronSafeStorage,
  registerElectronPrivateKey,
  warmSessionPrivateKeyFromSafeStorage,
  ELECTRON_STORED_KEY_UNLOCK_FAILED,
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
  getElectronPrivateKeyEncryptionStatus,
};

function syncPlatformLoggedInKeySession(keyId: string): void {
  if (!hasPlatformSafeStorageBridge()) {
    return;
  }

  if (isElectronApp() && window.electron) {
    window.electron.setTrayAuthState({
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
