import type { UploadedPrivateKeyMaterial } from '@/crypto/privateKeyMaterial.ts';
import { isSessionPrivateKeyStorageEnabled } from '@/utils/sessionPrivateKeyPreference.ts';

let cachedPrivateKeyMaterial: UploadedPrivateKeyMaterial | null = null;

export function clearSessionPrivateKeyStorage(): void {
  cachedPrivateKeyMaterial = null;
}

export function cachePrivateKeyMaterial(
  material: UploadedPrivateKeyMaterial,
): void {
  if (!isSessionPrivateKeyStorageEnabled()) {
    return;
  }
  cachedPrivateKeyMaterial = material;
}

export function getCachedPrivateKeyMaterial(): UploadedPrivateKeyMaterial | null {
  if (!isSessionPrivateKeyStorageEnabled()) {
    return null;
  }
  return cachedPrivateKeyMaterial;
}
