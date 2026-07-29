import { isElectronApp } from '@/utils/isElectronApp.ts';

export const SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY =
  'encrypt-session-private-key-storage-enabled';

const ENABLED_VALUE = '1';
const DISABLED_VALUE = '0';

let enabledInMemory = false;
let initialized = false;

function readStoredPreference(): boolean | null {
  try {
    const value = localStorage.getItem(
      SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY,
    );
    if (value === ENABLED_VALUE) {
      return true;
    }
    if (value === DISABLED_VALUE) {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

export function initSessionPrivateKeyStoragePreference(): boolean {
  if (isElectronApp()) {
    enabledInMemory = true;
  } else {
    const stored = readStoredPreference();
    enabledInMemory = stored ?? false;
  }
  initialized = true;
  return enabledInMemory;
}

function ensureSessionPrivateKeyStoragePreferenceInitialized(): void {
  if (!initialized) {
    initSessionPrivateKeyStoragePreference();
  }
}

export function hasExplicitlyDisabledPrivateKeyStorage(): boolean {
  if (isElectronApp()) {
    return false;
  }
  return readStoredPreference() === false;
}

export function isSessionPrivateKeyStorageEnabled(): boolean {
  ensureSessionPrivateKeyStoragePreferenceInitialized();
  return enabledInMemory;
}

export function isPrivateKeyMemoryCacheEnabled(): boolean {
  if (isElectronApp()) {
    return true;
  }
  ensureSessionPrivateKeyStoragePreferenceInitialized();
  if (hasExplicitlyDisabledPrivateKeyStorage()) {
    return false;
  }
  return enabledInMemory;
}

export function setSessionPrivateKeyStorageEnabled(enabled: boolean): void {
  if (isElectronApp()) {
    enabledInMemory = true;
    initialized = true;
    return;
  }

  enabledInMemory = enabled;
  initialized = true;
  try {
    localStorage.setItem(
      SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY,
      enabled ? ENABLED_VALUE : DISABLED_VALUE,
    );
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function clearSessionPrivateKeyStoragePreference(): void {
  if (isElectronApp()) {
    initialized = true;
    enabledInMemory = true;
    return;
  }

  try {
    localStorage.removeItem(SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY);
  } catch {
    /* ignore */
  }
  initialized = true;
  enabledInMemory = false;
}
