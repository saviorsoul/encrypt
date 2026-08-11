import { useCallback, useMemo } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { getCachedPrivateKeyMaterial } from '@encrypt/platform/sessionPrivateKeyStorage';

export function useFeedntPrivateKey(keyId: string | null) {
  const withPrivateKey = useCallback(
    async <T>(
      fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
    ): Promise<T | null> => {
      const material = getCachedPrivateKeyMaterial();
      if (!material || material.keyId !== keyId) {
        return null;
      }
      return fn(material);
    },
    [keyId],
  );

  return useMemo(
    () => ({
      keyId,
      isSystemAppSession: false as const,
      withPrivateKey,
    }),
    [keyId, withPrivateKey],
  );
}
