import { useCallback, useMemo, useRef, useState } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { jwkWithoutKeyOps } from '@encrypt/core/crypto/ecdhKeys';
import {
  createFeedApiAuthProvider,
  clearFeedApiAuthState,
  releaseFeedApiAuthKeySwitch,
  type FeedApiAuthProvider,
} from '@encrypt/core/api/feedApiAuth';
import { createExternalFeedApiAuthProvider } from '@encrypt/core/api/externalFeedApiAuth';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
} from '@web/crypto/sessionPrivateKeyStorage.ts';
import {
  pickPrivateKeyJwkFile,
  pickPrivateKeyJwkFileWithName,
  isPrivateKeyFileSelectionCancelled,
} from '@web/crypto/privateKeyFile.ts';
import {
  disconnectSystemAppBridge,
  getFeedLabSessionMode,
  loadFeedLabBridgePairing,
  type FeedLabSessionMode,
} from '@lab/crypto/systemAppPairingStorage.ts';
import {
  getSystemAppAuthKeyId,
  getSystemAppAuthPublicKey,
  syncSystemAppAuthSession,
} from '@lab/crypto/systemAppAuthSession.ts';
import {
  pairWithSystemApp,
  requestBridgeOracle,
  isBridgeCancellationError,
} from '@lab/crypto/systemAppSigner.ts';
import {
  systemDecryptComment,
  systemDecryptComments,
  systemDecryptMessage,
  systemEncryptComment,
  systemEncryptMessage,
  systemEncryptShare,
  type FeedLabBridgeEncryptMessageResult,
  type FeedLabBridgeEncryptCommentResult,
  type FeedLabBridgeEncryptShareResult,
} from '@lab/crypto/systemAppBridgeClient.ts';
import type {
  FeedLabBridgeDecryptCommentPayload,
  FeedLabBridgeDecryptCommentsPayload,
  FeedLabBridgeDecryptMessagePayload,
  FeedLabBridgeEncryptCommentPayload,
  FeedLabBridgeEncryptSharePayload,
  FeedLabBridgeRecipientWire,
} from '@encrypt/core/feed/feedLabBridgeClientCrypto';
import { clearBridgeSessionKey } from '@lab/crypto/bridgeSessionKey.ts';
import { clearFriendshipsCache } from '@lab/services/friendshipsCache.ts';

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

const fileKeyAuthProvider = createFeedApiAuthProvider(
  resolvePrivateKeyMaterial,
  { challengeUrl: `${getApiBaseUrl()}/api/auth/challenge` },
);

const authConfig = { challengeUrl: `${getApiBaseUrl()}/api/auth/challenge` };

const systemAppAuthProvider = createExternalFeedApiAuthProvider(
  {
    getKeyId: getSystemAppAuthKeyId,
    getPublicKey: getSystemAppAuthPublicKey,
    requestBridgeOracle,
  },
  authConfig,
);

function resolveInitialSession(): {
  mode: FeedLabSessionMode;
  keyId: string | null;
  publicKey: AuthPublicKeyCoords | null;
} {
  const mode = getFeedLabSessionMode();
  if (mode === 'system-app') {
    const pairing = loadFeedLabBridgePairing();
    if (pairing) {
      return {
        mode,
        keyId: pairing.keyId,
        publicKey: pairing.publicKey,
      };
    }
  }
  const material = readSessionMaterial();
  return {
    mode: 'file-key',
    keyId: material?.keyId ?? null,
    publicKey: material?.publicKey ?? null,
  };
}

async function recipientsToWire(
  recipients: ManifestRecipientKeys[],
): Promise<FeedLabBridgeRecipientWire[]> {
  const wire: FeedLabBridgeRecipientWire[] = [];
  for (const recipient of recipients) {
    const exported = await crypto.subtle.exportKey('jwk', recipient.publicKey);
    wire.push({
      keyId: recipient.keyId,
      publicJwk: jwkWithoutKeyOps(exported),
    });
  }
  return wire;
}

function bootstrapSystemAppAuthSession(): void {
  if (getFeedLabSessionMode() !== 'system-app') {
    return;
  }
  const pairing = loadFeedLabBridgePairing();
  if (!pairing) {
    return;
  }
  syncSystemAppAuthSession(pairing.keyId, pairing.publicKey);
}

bootstrapSystemAppAuthSession();

export function usePrivateKeySession() {
  const initialSession = useMemo(() => resolveInitialSession(), []);
  const [sessionMode, setSessionMode] = useState<FeedLabSessionMode>(
    initialSession.mode,
  );
  const sessionModeRef = useRef<FeedLabSessionMode>(initialSession.mode);

  const setSessionModeSync = useCallback((mode: FeedLabSessionMode) => {
    sessionModeRef.current = mode;
    setSessionMode(mode);
  }, []);
  const [keyId, setKeyId] = useState<string | null>(initialSession.keyId);
  const [publicKey, setPublicKey] = useState<AuthPublicKeyCoords | null>(
    initialSession.publicKey,
  );
  const [privateKeyFileName, setPrivateKeyFileName] = useState<string | null>(
    null,
  );
  const [sessionError, setSessionError] = useState<string | null>(null);

  if (sessionMode === 'system-app') {
    syncSystemAppAuthSession(keyId, publicKey);
  } else {
    syncSystemAppAuthSession(null, null);
  }

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const authProvider = useMemo<FeedApiAuthProvider>(
    () => ({
      getAuthHeaders: (request, options) =>
        (sessionModeRef.current === 'system-app'
          ? systemAppAuthProvider
          : fileKeyAuthProvider
        ).getAuthHeaders(request, options),
      captureNextNonceFromResponse: (keyId, response) =>
        (sessionModeRef.current === 'system-app'
          ? systemAppAuthProvider
          : fileKeyAuthProvider
        ).captureNextNonceFromResponse(keyId, response),
    }),
    [],
  );

  const isSystemAppSession = sessionMode === 'system-app';

  const withPrivateKey = useCallback(
    async <T>(
      fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
    ): Promise<T | null> => {
      if (isSystemAppSession) {
        throw new Error(
          'Direct private key access is not available in Encrypt app mode. Use system crypto operations.',
        );
      }

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
    [isSystemAppSession],
  );

  const systemEncryptMessageFn = useCallback(
    async (
      plaintext: string,
      recipients: ManifestRecipientKeys[],
    ): Promise<FeedLabBridgeEncryptMessageResult | null> => {
      if (!isSystemAppSession) {
        return null;
      }
      return systemEncryptMessage({
        plaintext,
        recipients: await recipientsToWire(recipients),
      });
    },
    [isSystemAppSession],
  );

  const systemEncryptShareFn = useCallback(
    async (
      payload: FeedLabBridgeEncryptSharePayload,
    ): Promise<FeedLabBridgeEncryptShareResult> => {
      return systemEncryptShare(payload);
    },
    [],
  );

  const systemEncryptCommentFn = useCallback(
    async (
      payload: FeedLabBridgeEncryptCommentPayload,
    ): Promise<FeedLabBridgeEncryptCommentResult> => {
      return systemEncryptComment(payload);
    },
    [],
  );

  const systemDecryptMessageFn = useCallback(
    async (
      payload: FeedLabBridgeDecryptMessagePayload,
    ): Promise<{ plaintext: string }> => {
      return systemDecryptMessage(payload);
    },
    [],
  );

  const systemDecryptCommentFn = useCallback(
    async (
      payload: FeedLabBridgeDecryptCommentPayload,
    ): Promise<{ plaintext: string }> => {
      return systemDecryptComment(payload);
    },
    [],
  );

  const systemDecryptCommentsFn = useCallback(
    async (
      payload: FeedLabBridgeDecryptCommentsPayload,
    ): Promise<{ decrypted: Record<string, string> }> => {
      return systemDecryptComments(payload);
    },
    [],
  );

  const pairWithEncryptApp = useCallback(async (): Promise<string | null> => {
    setSessionError(null);
    try {
      const pairing = await pairWithSystemApp();
      setSessionModeSync('system-app');
      setKeyId(pairing.keyId);
      setPublicKey(pairing.publicKey);
      setPrivateKeyFileName(null);
      return pairing.keyId;
    } catch (error) {
      if (isBridgeCancellationError(error)) {
        return null;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to connect to the Encrypt app.';
      setSessionError(message);
      return null;
    }
  }, [setSessionModeSync]);

  const changeKeyId = useCallback(async (): Promise<string | null> => {
    setSessionError(null);
    try {
      const previousKeyId = keyId;
      const picked = await pickPrivateKeyJwkFileWithName();
      const material = await importUploadedPrivateKeyMaterial(picked.jwk);
      disconnectSystemAppBridge();
      clearBridgeSessionKey();
      clearFriendshipsCache(previousKeyId ?? undefined);
      rememberSessionMaterial(material);
      setSessionModeSync('file-key');
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
  }, [keyId, setSessionModeSync]);

  const clearSession = useCallback(() => {
    const previousKeyId = keyId;
    clearSessionMaterial();
    disconnectSystemAppBridge();
    clearBridgeSessionKey();
    clearFriendshipsCache(previousKeyId ?? undefined);
    setSessionModeSync('file-key');
    setKeyId(null);
    setPublicKey(null);
    setPrivateKeyFileName(null);
    setSessionError(null);
  }, [keyId, setSessionModeSync]);

  const adoptPrivateKeyJwk = useCallback(
    async (jwk: JsonWebKey) => {
      setSessionError(null);
      try {
        const previousKeyId = keyId;
        const material = await importUploadedPrivateKeyMaterial(jwk);
        disconnectSystemAppBridge();
        clearBridgeSessionKey();
        clearFriendshipsCache(previousKeyId ?? undefined);
        rememberSessionMaterial(material);
        setSessionModeSync('file-key');
        setKeyId(material.keyId);
        setPublicKey(material.publicKey);
        return material;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Invalid private key file.';
        setSessionError(message);
        throw error;
      }
    },
    [keyId, setSessionModeSync],
  );

  return {
    keyId,
    publicKey,
    privateKeyFileName,
    sessionError,
    sessionMode,
    isSystemAppSession,
    authProvider,
    getPrivateKeyMaterial: resolvePrivateKeyMaterial,
    withPrivateKey,
    systemEncryptMessage: systemEncryptMessageFn,
    systemEncryptShare: systemEncryptShareFn,
    systemEncryptComment: systemEncryptCommentFn,
    systemDecryptMessage: systemDecryptMessageFn,
    systemDecryptComment: systemDecryptCommentFn,
    systemDecryptComments: systemDecryptCommentsFn,
    pairWithEncryptApp,
    changeKeyId,
    adoptPrivateKeyJwk,
    clearSession,
    clearSessionError,
  };
}
