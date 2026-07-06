import { useCallback, useMemo, useState } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import {
  createFeedApiAuthProvider,
  clearFeedApiAuthState,
  releaseFeedApiAuthKeySwitch,
  type FeedApiAuthProvider,
} from '@encrypt/core/api/feedApiAuth';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
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
  const previousKeyId = sessionMaterial?.keyId;
  sessionMaterial = material;
  cachePrivateKeyMaterial(material);
  // Keep per-keyId rotated nonces (X-Next-Nonce) so switching back reuses them.
  if (previousKeyId && previousKeyId !== material.keyId) {
    releaseFeedApiAuthKeySwitch(previousKeyId);
  }
}

function clearSessionMaterial(): void {
  sessionMaterial = null;
  clearSessionPrivateKeyStorage();
  clearFeedApiAuthState();
}

async function resolvePrivateKeyMaterial(): Promise<UploadedPrivateKeyMaterial | null> {
  return readSessionMaterial();
}

const feedLabAuthProvider = createFeedApiAuthProvider(
  resolvePrivateKeyMaterial,
  { challengeUrl: `${getApiBaseUrl()}/api/auth/challenge` },
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
        error instanceof Error ? error.message : 'Invalid private key file.';
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

  const adoptPrivateKeyJwk = useCallback(async (jwk: JsonWebKey) => {
    setSessionError(null);
    try {
      const material = await importUploadedPrivateKeyMaterial(jwk);
      rememberSessionMaterial(material);
      setKeyId(material.keyId);
      setPublicKey(material.publicKey);
      return material;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid private key file.';
      setSessionError(message);
      throw error;
    }
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
    adoptPrivateKeyJwk,
    clearSession,
    clearSessionError,
  };
}
