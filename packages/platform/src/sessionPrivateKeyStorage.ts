import { clearElectronSafeStoragePrivateKeys } from './electronSafeStoragePrivateKey.ts';
import { armPrivateKeySafeStorageBridgeSession } from './platformBridge.ts';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { isCapacitorApp } from './isCapacitorApp.ts';
import { isElectronApp } from './isElectronApp.ts';

let memoryCacheEnabled = true;
let cachedPrivateKeyMaterial: UploadedPrivateKeyMaterial | null = null;

export function setPrivateKeyMemoryCacheEnabled(enabled: boolean): void {
  memoryCacheEnabled = enabled;
}

export function isPrivateKeyMemoryCacheEnabled(): boolean {
  if (isElectronApp() || isCapacitorApp()) {
    return true;
  }
  return memoryCacheEnabled;
}

function armPlatformPrivateKeySession(keyId: string): void {
  armPrivateKeySafeStorageBridgeSession(keyId);
}

export function clearSessionPrivateKeyMemory(): void {
  cachedPrivateKeyMaterial = null;
}

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
