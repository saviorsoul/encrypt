import { useCallback, useState } from 'react';
import type { ShareMessageHistoryProgress } from '@encrypt/core/feed/shareMessageHistory';
import { shareMessageHistoryWithFriend } from '@encrypt/core/feed/shareMessageHistory';
import type { StoredFeedDelivery } from '@encrypt/core/feed/types';
import type { KeyManifestLookup } from '@encrypt/core/feed/access';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import type { FeedApi } from '@encrypt/core/api/feedApi';

export type ShareMessageHistoryKeys = {
  keyId: string | null;
};

export type UseShareMessageHistoryOptions = {
  api: Pick<
    FeedApi,
    'getAuthoredMessages' | 'getFriendships' | 'markMessageHistoryShared'
  >;
  shareMessagesBatch: (params: {
    messageIds: string[];
    recipients: ManifestRecipientKeys[];
    allDeliveries: StoredFeedDelivery[];
    manifestLookup: KeyManifestLookup;
    onProgress?: (done: number, total: number) => void;
  }) => Promise<void>;
  keys: ShareMessageHistoryKeys;
  importFriendPublicKey: (publicKeyJwk: {
    x: string;
    y: string;
  }) => Promise<CryptoKey>;
};

export function useShareMessageHistory(options: UseShareMessageHistoryOptions) {
  const { api, shareMessagesBatch, keys, importFriendPublicKey } = options;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ShareMessageHistoryProgress | null>(
    null,
  );

  const shareHistoryWithFriend = useCallback(
    async (friend: { keyId: string; publicKey: { x: string; y: string } }) => {
      setError(null);
      setProgress(null);

      if (!keys.keyId) {
        setError('Sign in to share message history.');
        return false;
      }

      setBusy(true);
      try {
        const friendPublicKey = await importFriendPublicKey(friend.publicKey);
        await shareMessageHistoryWithFriend({
          api,
          shareMessagesBatch,
          friendKeyId: friend.keyId,
          friendPublicKey,
          onProgress: setProgress,
        });
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to share message history.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api, importFriendPublicKey, keys.keyId, shareMessagesBatch],
  );

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    busy,
    error,
    progress,
    shareHistoryWithFriend,
    clearError,
    clearProgress,
  };
}
