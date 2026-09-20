import { useCallback } from 'react';
import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import { useShareMessageHistory } from '@encrypt/ui/useShareMessageHistory';
import { useFeedApi } from '@feednt/providers/FeedApiProvider.tsx';
import { useBackendShare } from '@feednt/hooks/useBackendShare.ts';
import type { useFeedntPrivateKey } from '@feednt/hooks/useFeedntPrivateKey.ts';

type KeysSession = ReturnType<typeof useFeedntPrivateKey>;

export function useBackendShareMessageHistory(
  keys: KeysSession,
  expectedKeyId: string | null,
) {
  const api = useFeedApi();
  const { shareMessagesBatch } = useBackendShare(keys, expectedKeyId);

  const importFriendPublicKey = useCallback(
    async (publicKeyJwk: { x: string; y: string }) =>
      importPublicKeyExtractable({
        kty: 'EC',
        crv: 'P-256',
        x: publicKeyJwk.x,
        y: publicKeyJwk.y,
      }),
    [],
  );

  return useShareMessageHistory({
    api,
    shareMessagesBatch,
    keys,
    importFriendPublicKey,
  });
}
