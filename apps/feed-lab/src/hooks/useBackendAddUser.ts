import { useCallback, useState } from 'react';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';
import { slimEcPublicJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { registerFeedLabRecipient } from '@lab/lib/registerFeedLabRecipient.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

export function useBackendAddUser(
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

  const addUser = useCallback(
    async (username: string, publicKeyText: string): Promise<string | null> => {
      setError(null);
      setInfo(null);
      setLastKeyId(null);

      const trimmedName = username.trim();
      if (!trimmedName) {
        setError('Enter a recipient name.');
        return null;
      }

      const parsed = parsePublicKeyText(publicKeyText);
      if (parsed.ok === false) {
        setError(parsed.error);
        return null;
      }

      const { x, y } = parsed.jwk;
      if (!x || !y) {
        setError('Public key must include x and y coordinates.');
        return null;
      }

      setBusy(true);
      try {
        const result = await registerFeedLabRecipient(
          api,
          trimmedName,
          slimEcPublicJwk(parsed.jwk),
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

        setLastKeyId(result.keyId);
        onRegistered?.(result.user);
        return result.keyId;
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
  }, []);

  return {
    busy,
    error,
    info,
    lastKeyId,
    addUser,
    clearError,
    clearInfo,
    clearLastKeyId,
  };
}
