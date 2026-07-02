import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Friendship, FriendshipRequest } from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

export type FeedLabFriend = {
  keyId: string;
  label: string;
  publicKey: { x: string; y: string };
};

function labelForKeyId(
  keyId: string,
  usernameByKeyId: Record<string, string>,
): string {
  return usernameByKeyId[keyId] ?? keyId;
}

function mapFriendshipsToFriends(
  friendships: Friendship[],
  usernameByKeyId: Record<string, string>,
): FeedLabFriend[] {
  return friendships.map((friendship) => ({
    keyId: friendship.friendKeyId,
    label: labelForKeyId(friendship.friendKeyId, usernameByKeyId),
    publicKey: friendship.publicKey,
  }));
}

export function useFeedLabFriendships(
  ownerKeyId: string | null,
  usernameByKeyId: Record<string, string>,
) {
  const api = useFeedApi();
  const [friends, setFriends] = useState<FeedLabFriend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerKeyId) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [friendships, requests] = await Promise.all([
        api.getFriendships(),
        api.getFriendshipRequests(),
      ]);
      setFriends(mapFriendshipsToFriends(friendships, usernameByKeyId));
      setIncomingRequests(requests.incoming);
      setOutgoingRequests(requests.outgoing);
    } catch (e) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setError(e instanceof Error ? e.message : 'Failed to load friendships.');
    } finally {
      setLoading(false);
    }
  }, [api, ownerKeyId, usernameByKeyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const friendKeyIds = useMemo(
    () => friends.map((friend) => friend.keyId),
    [friends],
  );

  const friendLabels = useMemo(
    () => friends.map((friend) => friend.label),
    [friends],
  );

  return {
    friends,
    friendKeyIds,
    friendLabels,
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    refresh,
  };
}
