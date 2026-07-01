import { useCallback, useState } from 'react';
import { downloadJsonFile } from '@/utils/downloadJson.ts';
import { privateKeyDownloadFilename } from '@/utils/privateKeyFilename.ts';
import {
  exportPublicKeyJwk,
  generateExtractableEcdhKeyPair,
  jwkWithoutKeyOps,
} from '@encrypt/core/crypto/ecdhKeys';
import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { registerFeedLabRecipient } from '@lab/lib/registerFeedLabRecipient.ts';
import { loadFeedLabUserByUsername } from '@lab/services/db/storedUsers.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

export function useBackendGenerateUser(
  onRegistered?: (input: {
    keyId: string;
    username: string;
    publicKey: { x: string; y: string };
  }) => void,
) {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lastKeyId, setLastKeyId] = useState<string | null>(null);
  const [lastUsername, setLastUsername] = useState<string | null>(null);

  const generateUser = useCallback(
    async (username: string): Promise<string | null> => {
      setError(null);
      setInfo(null);
      setLastKeyId(null);
      setLastUsername(null);

      const trimmedName = username.trim();
      if (!trimmedName) {
        setError('Enter a recipient name.');
        return null;
      }

      const existing = await loadFeedLabUserByUsername(trimmedName);
      if (existing) {
        setError(`"${trimmedName}" already exists. Choose a unique name.`);
        return null;
      }

      setBusy(true);
      try {
        const keyPair = await generateExtractableEcdhKeyPair();
        const publicJwk = await exportPublicKeyJwk(keyPair);
        const privateJwk = slimEcPrivateJwk(
          (await crypto.subtle.exportKey(
            'jwk',
            keyPair.privateKey,
          )) as JsonWebKey,
        );

        const result = await registerFeedLabRecipient(
          api,
          trimmedName,
          publicJwk,
        );

        if (result.status === 'error') {
          setError(result.message);
          return null;
        }

        if (result.status === 'already_saved') {
          setInfo(
            `User is already saved as a recipient as "${result.username}".`,
          );
          return result.keyId;
        }

        downloadJsonFile(
          jwkWithoutKeyOps(privateJwk),
          privateKeyDownloadFilename(trimmedName),
        );

        setLastKeyId(result.keyId);
        setLastUsername(trimmedName);
        onRegistered?.(result.user);
        return result.keyId;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to generate recipient keys.',
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, onRegistered],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearInfo = useCallback(() => {
    setInfo(null);
  }, []);

  const clearLastKeyId = useCallback(() => {
    setLastKeyId(null);
    setLastUsername(null);
  }, []);

  return {
    busy,
    error,
    info,
    lastKeyId,
    lastUsername,
    generateUser,
    clearError,
    clearInfo,
    clearLastKeyId,
  };
}
