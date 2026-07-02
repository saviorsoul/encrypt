import { useCallback, useMemo, useState } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';
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
  const [publicKey, setPublicKey] = useState<AuthPublicKeyCoords | null>(
    () => readSessionMaterial()?.publicKey ?? null,
  );
  const [privateKeyFileName, setPrivateKeyFileName] = useState<string | null>(
    null,
  );
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

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
          setPublicKey(cached.publicKey);
          return await fn(cached);
        }

        const jwk = await pickPrivateKeyJwkFile();
        const material = await importUploadedPrivateKeyMaterial(jwk);
        rememberSessionMaterial(material);
        setKeyId(material.keyId);
        setPublicKey(material.publicKey);
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
    setSessionError(null);
    try {
      const picked = await pickPrivateKeyJwkFileWithName();
      const material = await importUploadedPrivateKeyMaterial(picked.jwk);
      rememberSessionMaterial(material);
      setKeyId(material.keyId);
      setPublicKey(material.publicKey);
      setPrivateKeyFileName(picked.fileName);
      return material.keyId;
    } catch (error) {
      if (isPrivateKeyFileSelectionCancelled(error)) {
        return null;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Invalid private key file.';
      setSessionError(message);
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearSessionMaterial();
    setKeyId(null);
    setPublicKey(null);
    setPrivateKeyFileName(null);
    setSessionError(null);
  }, []);

  return {
    keyId,
    publicKey,
    privateKeyFileName,
    sessionError,
    authProvider,
    getPrivateKeyMaterial: resolvePrivateKeyMaterial,
    withPrivateKey,
    changeKeyId,
    clearSession,
    clearSessionError,
  };
}
