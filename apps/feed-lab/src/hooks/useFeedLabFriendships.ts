import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Friendship, FriendshipRequest } from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { buildSentInvitationLabelByToken } from '@lab/services/db/sentInvitations.ts';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';

export type FeedLabFriend = {
  keyId: string;
  label: string;
  publicKey: { x: string; y: string };
};

function labelForFriend(
  friendKeyId: string,
  usernameByKeyId: Record<string, string>,
  invitationToken: string | null | undefined,
  invitationLabelByToken: Record<string, string>,
): string {
  if (invitationToken) {
    const invitationLabel = invitationLabelByToken[invitationToken]?.trim();
    if (invitationLabel) {
      return invitationLabel;
    }
  }
  return usernameByKeyId[friendKeyId] ?? friendKeyId;
}

function mapFriendshipsToFriends(
  friendships: Friendship[],
  usernameByKeyId: Record<string, string>,
  invitationLabelByToken: Record<string, string>,
): FeedLabFriend[] {
  return friendships.map((friendship) => ({
    keyId: friendship.friendKeyId,
    label: labelForFriend(
      friendship.friendKeyId,
      usernameByKeyId,
      friendship.invitationToken,
      invitationLabelByToken,
    ),
    publicKey: friendship.publicKey,
  }));
}

export function useFeedLabFriendships(
  ownerKeyId: string | null,
  usernameByKeyId: Record<string, string>,
  addLocalUser?: (input: { keyId: string; username: string }) => void,
) {
  const api = useFeedApi();
  const [rawFriendships, setRawFriendships] = useState<Friendship[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [invitationLabelByToken, setInvitationLabelByToken] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerKeyId) {
      setRawFriendships([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setInvitationLabelByToken({});
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [friendships, requests, labels] = await Promise.all([
        api.getFriendships(),
        api.getFriendshipRequests(),
        buildSentInvitationLabelByToken(ownerKeyId),
      ]);
      setRawFriendships(friendships);
      setIncomingRequests(requests.incoming);
      setOutgoingRequests(requests.outgoing);
      setInvitationLabelByToken(labels);
    } catch (e) {
      setRawFriendships([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setInvitationLabelByToken({});
      setError(e instanceof Error ? e.message : 'Failed to load friendships.');
    } finally {
      setLoading(false);
    }
  }, [api, ownerKeyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!ownerKeyId || !addLocalUser || rawFriendships.length === 0) {
      return;
    }

    void (async () => {
      for (const friendship of rawFriendships) {
        const token = friendship.invitationToken;
        if (!token) {
          continue;
        }

        const label = invitationLabelByToken[token]?.trim();
        if (!label) {
          continue;
        }
        if (usernameByKeyId[friendship.friendKeyId] === label) {
          continue;
        }

        try {
          await saveFeedLabUser(
            ownerKeyId,
            label,
            {
              kty: 'EC',
              crv: 'P-256',
              x: friendship.publicKey.x,
              y: friendship.publicKey.y,
            },
          );
          addLocalUser({ keyId: friendship.friendKeyId, username: label });
        } catch {
          /* username may already be taken by another key */
        }
      }
    })();
  }, [
    addLocalUser,
    invitationLabelByToken,
    ownerKeyId,
    rawFriendships,
    usernameByKeyId,
  ]);

  const friends = useMemo(
    () =>
      mapFriendshipsToFriends(
        rawFriendships,
        usernameByKeyId,
        invitationLabelByToken,
      ),
    [rawFriendships, usernameByKeyId, invitationLabelByToken],
  );

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
    invitationLabelByToken,
    loading,
    error,
    refresh,
  };
}
