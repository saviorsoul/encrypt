export type { PlatformAdapter, PrivateKeySafeStorageStatus, StoredPrivateKeyJwkPayload, TrayAuthState } from './types.ts';
export { createPlatformAdapter } from './runtime.ts';
export {
  withUploadedPrivateKey,
  importPlatformPrivateKeyFromFile,
  importElectronPrivateKeyFromFile,
  isPrivateKeyFileSelectionCancelled,
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkFileWithName,
  pickPrivateKeyJwkInElectronNativeDialog,
  readPrivateKeyJwkFromFile,
  parsePrivateKeyJwkText,
  readPrivateKeyJwkFromText,
} from './privateKeyFile.ts';
export {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyMemory,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
  isPrivateKeyMemoryCacheEnabled,
  setPrivateKeyMemoryCacheEnabled,
} from './sessionPrivateKeyStorage.ts';
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
  getElectronPrivateKeyEncryptionStatus,
  ELECTRON_STORED_KEY_UNLOCK_FAILED,
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_LOOKUP_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
} from './electronSafeStoragePrivateKey.ts';
export {
  getActivePrivateKeyId,
  setActivePrivateKeyId,
} from './activePrivateKeyId.ts';
export { isElectronApp } from './isElectronApp.ts';
export { isCapacitorApp } from './isCapacitorApp.ts';
export {
  armPrivateKeySafeStorageSession,
  beginPrivateKeySafeStorageSession,
  getPrivateKeySafeStorageSessionState,
  resetPrivateKeySafeStorageSession,
  setPrivateKeySafeStorageAuthState,
} from './privateKeySafeStorageSession.ts';
