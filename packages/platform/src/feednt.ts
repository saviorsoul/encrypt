export {
  createFeedntPlatformAdapter,
  FEEDNT_KEY_ALREADY_STORED_MESSAGE,
  FEEDNT_MULTIPLE_STORED_PRIVATE_KEYS_MESSAGE,
  FEEDNT_NO_STORED_PRIVATE_KEY_MESSAGE,
  FEEDNT_REQUIRES_NATIVE_APP_MESSAGE,
  importPrivateKeyToSafeStorage,
  isPrivateKeyImportSelectionCancelled,
  unlockPrivateKeyMaterialFromSafeStorage,
  withSafeStoragePrivateKey,
} from './safeStoragePrivateKeyUnlock.ts';
