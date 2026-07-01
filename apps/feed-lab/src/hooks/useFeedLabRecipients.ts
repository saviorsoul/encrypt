import { useEffect, useMemo, useState } from 'react';
import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import type { FeedLabFriend } from '@lab/hooks/useFeedLabFriendships.ts';

type FeedLabRecipientsInput = {
  friends: FeedLabFriend[];
  loadingFriends: boolean;
  friendsError: string | null;
};

function toPublicJwk(publicKey: { x: string; y: string }): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: publicKey.x,
    y: publicKey.y,
  };
}

export function useFeedLabRecipients({
  friends,
  loadingFriends,
  friendsError,
}: FeedLabRecipientsInput) {
  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<ManifestRecipientKeys[]>([]);
  const [loadingRecipientKeys, setLoadingRecipientKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevFriendKeyIdsKey, setPrevFriendKeyIdsKey] = useState('');

  const friendKeyIdsKey = friends.map((friend) => friend.keyId).join('\0');
  const friendByKeyId = useMemo(
    () => new Map(friends.map((friend) => [friend.keyId, friend])),
    [friends],
  );
  const recipientOptions = useMemo(
    () => friends.map((friend) => friend.keyId),
    [friends],
  );
  const getOptionLabel = useMemo(
    () => (keyId: string) => friendByKeyId.get(keyId)?.label ?? keyId,
    [friendByKeyId],
  );

  if (friendKeyIdsKey !== prevFriendKeyIdsKey) {
    setPrevFriendKeyIdsKey(friendKeyIdsKey);
    setSelectedKeyIds((prev) => {
      const stillValid = prev.filter((keyId) => friendByKeyId.has(keyId));
      if (stillValid.length > 0) {
        return stillValid;
      }
      return friends.map((friend) => friend.keyId);
    });
  }

  useEffect(() => {
    if (friendsError) {
      setSelectedKeyIds([]);
    }
  }, [friendsError]);

  useEffect(() => {
    if (selectedKeyIds.length === 0) {
      setRecipients([]);
      setLoadingRecipientKeys(false);
      return;
    }

    let cancelled = false;

    async function loadRecipients() {
      setLoadingRecipientKeys(true);
      setError(null);
      try {
        const loaded = await Promise.all(
          selectedKeyIds.map(async (keyId) => {
            const friend = friendByKeyId.get(keyId);
            if (!friend) {
              return null;
            }
            const publicKey = await importPublicKeyExtractable(
              toPublicJwk(friend.publicKey),
            );
            return { keyId, publicKey };
          }),
        );

        if (cancelled) {
          return;
        }

        const missing = selectedKeyIds.filter(
          (_, index) => loaded[index] === null,
        );
        if (missing.length > 0) {
          setError(`No public key found for: ${missing.join(', ')}`);
          setRecipients(
            loaded.filter(
              (entry): entry is ManifestRecipientKeys => entry !== null,
            ),
          );
          return;
        }

        setRecipients(loaded as ManifestRecipientKeys[]);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load recipient keys.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipientKeys(false);
        }
      }
    }

    void loadRecipients();

    return () => {
      cancelled = true;
    };
  }, [selectedKeyIds, friendByKeyId]);

  return {
    selectedKeyIds,
    setSelectedKeyIds,
    recipientOptions,
    getOptionLabel,
    recipients,
    loadingFriends,
    loadingRecipientKeys,
    error: error ?? friendsError,
  };
}
