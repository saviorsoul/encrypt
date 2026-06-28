export const SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY =
  'encrypt-session-private-key-storage-enabled';

let enabledInMemory = false;

function readStoredPreference(): boolean {
  try {
    return (
      localStorage.getItem(SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function initSessionPrivateKeyStoragePreference(): boolean {
  enabledInMemory = readStoredPreference();
  return enabledInMemory;
}

export function isSessionPrivateKeyStorageEnabled(): boolean {
  return enabledInMemory;
}

export function setSessionPrivateKeyStorageEnabled(enabled: boolean): void {
  enabledInMemory = enabled;
  try {
    if (enabled) {
      localStorage.setItem(SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY, '1');
    } else {
      localStorage.removeItem(SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY);
    }
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function clearSessionPrivateKeyStoragePreference(): void {
  enabledInMemory = false;
  try {
    localStorage.removeItem(SESSION_PRIVATE_KEY_STORAGE_PREFERENCE_KEY);
  } catch {
    /* ignore */
  }
}
