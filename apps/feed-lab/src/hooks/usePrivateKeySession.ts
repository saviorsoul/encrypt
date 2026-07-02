import { useCallback, useMemo, useState } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import {
  createFeedApiAuthProvider,
  clearFeedApiAuthHeaderCache,
  type FeedApiAuthProvider,
} from '@encrypt/core/api/feedApiAuth';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkFileWithName,
  isPrivateKeyFileSelectionCancelled,
} from '@/crypto/privateKeyFile.ts';

let sessionMaterial: UploadedPrivateKeyMaterial | null = null;

function readSessionMaterial(): UploadedPrivateKeyMaterial | null {
  if (sessionMaterial) {
    return sessionMaterial;
  }
  return getCachedPrivateKeyMaterial();
}

function rememberSessionMaterial(material: UploadedPrivateKeyMaterial): void {
  sessionMaterial = material;
  cachePrivateKeyMaterial(material);
  clearFeedApiAuthHeaderCache();
}

function clearSessionMaterial(): void {
  sessionMaterial = null;
  clearSessionPrivateKeyStorage();
  clearFeedApiAuthHeaderCache();
}

async function resolvePrivateKeyMaterial(): Promise<UploadedPrivateKeyMaterial | null> {
  return readSessionMaterial();
}

const feedLabAuthProvider = createFeedApiAuthProvider(
  resolvePrivateKeyMaterial,
);

export function usePrivateKeySession() {
  const [keyId, setKeyId] = useState<string | null>(
    () => readSessionMaterial()?.keyId ?? null,
  );
  const [privateKeyFileName, setPrivateKeyFileName] = useState<string | null>(
    null,
  );

  const authProvider = useMemo<FeedApiAuthProvider>(
    () => feedLabAuthProvider,
    [],
  );

  const withPrivateKey = useCallback(
    async <T>(
      fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
    ): Promise<T | null> => {
      try {
        const cached = readSessionMaterial();
        if (cached) {
          setKeyId(cached.keyId);
          return await fn(cached);
        }

        const jwk = await pickPrivateKeyJwkFile();
        const material = await importUploadedPrivateKeyMaterial(jwk);
        rememberSessionMaterial(material);
        setKeyId(material.keyId);
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
      const material = await importUploadedPrivateKeyMaterial(picked.jwk);
      rememberSessionMaterial(material);
      setKeyId(material.keyId);
      setPrivateKeyFileName(picked.fileName);
      return material.keyId;
    } catch (error) {
      if (isPrivateKeyFileSelectionCancelled(error)) {
        return null;
      }
      throw error;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearSessionMaterial();
    setKeyId(null);
    setPrivateKeyFileName(null);
  }, []);

  return {
    keyId,
    privateKeyFileName,
    authProvider,
    getPrivateKeyMaterial: resolvePrivateKeyMaterial,
    withPrivateKey,
    changeKeyId,
    clearSession,
  };
}
