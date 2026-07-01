import { useCallback, useState } from 'react';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

export function useBackendAddUser() {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastKeyId, setLastKeyId] = useState<string | null>(null);

  const addUser = useCallback(
    async (publicKeyText: string): Promise<string | null> => {
      setError(null);
      setLastKeyId(null);

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
        const result = await api.postUser({ publicKey: { x, y } });
        setLastKeyId(result.keyId);
        return result.keyId;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to register user.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLastKeyId = useCallback(() => {
    setLastKeyId(null);
  }, []);

  return {
    busy,
    error,
    lastKeyId,
    addUser,
    clearError,
    clearLastKeyId,
  };
}
