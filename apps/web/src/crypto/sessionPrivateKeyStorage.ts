import { clearElectronSafeStoragePrivateKeys } from '@/crypto/electronSafeStoragePrivateKey.ts';
import type { UploadedPrivateKeyMaterial } from '@/crypto/privateKeyMaterial.ts';
import { isCapacitorApp } from '@/utils/isCapacitorApp.ts';
import { isElectronApp } from '@/utils/isElectronApp.ts';
import { isPrivateKeyMemoryCacheEnabled } from '@/utils/sessionPrivateKeyPreference.ts';

let cachedPrivateKeyMaterial: UploadedPrivateKeyMaterial | null = null;

function armPlatformPrivateKeySession(keyId: string): void {
  if (isElectronApp() && window.electron?.privateKeySafeStorage?.armSession) {
    void window.electron.privateKeySafeStorage.armSession(keyId);
    return;
  }

  if (
    isCapacitorApp() &&
    window.capacitorBridge?.privateKeySafeStorage?.armSession
  ) {
    void window.capacitorBridge.privateKeySafeStorage.armSession(keyId);
  }
}

/** Drop imported CryptoKeys from memory only. */
export function clearSessionPrivateKeyMemory(): void {
  cachedPrivateKeyMaterial = null;
}

/** Drop memory cache and delete OS-backed private key files. */
export function clearSessionPrivateKeyStorage(): void {
  clearSessionPrivateKeyMemory();
  clearElectronSafeStoragePrivateKeys();
}

export function cachePrivateKeyMaterial(
  material: UploadedPrivateKeyMaterial,
): void {
  if (!isPrivateKeyMemoryCacheEnabled()) {
    return;
  }
  cachedPrivateKeyMaterial = material;
  armPlatformPrivateKeySession(material.keyId);
}

export function getCachedPrivateKeyMaterial(): UploadedPrivateKeyMaterial | null {
  if (!isPrivateKeyMemoryCacheEnabled()) {
    return null;
  }
  return cachedPrivateKeyMaterial;
}
