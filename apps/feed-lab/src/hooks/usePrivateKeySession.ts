import { useCallback, useState } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPrivateJwk,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import {
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkFileWithName,
  isPrivateKeyFileSelectionCancelled,
} from '@/crypto/privateKeyFile.ts';

async function keyIdFromPrivateJwk(jwk: JsonWebKey): Promise<string> {
  return ecPublicJwkThumbprintSha256(
    slimEcPublicJwk(slimEcPrivateJwk(jwk)),
  );
}

export function usePrivateKeySession() {
  const [keyId, setKeyId] = useState<string | null>(null);
  const [privateKeyFileName, setPrivateKeyFileName] = useState<string | null>(
    null,
  );

  const withPrivateKey = useCallback(
    async <T>(
      fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
    ): Promise<T | null> => {
      try {
        const jwk = await pickPrivateKeyJwkFile();
        const material = await importUploadedPrivateKeyMaterial(jwk);
        return await fn(material);
      } catch (error) {
        if (isPrivateKeyFileSelectionCancelled(error)) {
          return null;
        }
        throw error;
      }
    },
    [],
  );

  const changeKeyId = useCallback(async (): Promise<string | null> => {
    try {
      const picked = await pickPrivateKeyJwkFileWithName();
      const nextKeyId = await keyIdFromPrivateJwk(picked.jwk);
      setKeyId(nextKeyId);
      setPrivateKeyFileName(picked.fileName);
      return nextKeyId;
    } catch (error) {
      if (isPrivateKeyFileSelectionCancelled(error)) {
        return null;
      }
      throw error;
    }
  }, []);

  return {
    keyId,
    privateKeyFileName,
    withPrivateKey,
    changeKeyId,
  };
}
