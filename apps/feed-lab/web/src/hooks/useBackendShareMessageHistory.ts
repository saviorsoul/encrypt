import { useCallback } from 'react';
import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import { useShareMessageHistory } from '@encrypt/ui/useShareMessageHistory';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type KeysSession = ReturnType<typeof usePrivateKeySession>;

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
