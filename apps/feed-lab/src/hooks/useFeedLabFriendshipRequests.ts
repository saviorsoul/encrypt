export type { PendingInvitation } from '@lab/services/friendshipsCache.ts';

import { useCallback, useEffect, useState } from 'react';
import type { FriendshipRequest } from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { friendshipRequestErrorMessage } from '@lab/lib/friendshipRequestErrors.ts';
import {
  cacheHasUsersData,
  getFriendshipsCache,
  setFriendshipsCache,
} from '@lab/services/friendshipsCache.ts';

export type RefreshFriendshipRequestsOptions = {
  force?: boolean;
};

export function useFeedLabFriendshipRequests(ownerKeyId: string | null) {
  const api = useFeedApi();
  const [incomingRequests, setIncomingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (refreshOptions?: RefreshFriendshipRequestsOptions) => {
      if (!ownerKeyId) {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setError(null);
        return;
      }

      const force = refreshOptions?.force === true;
      if (!force) {
        const cached = getFriendshipsCache(ownerKeyId);
        if (cached && cacheHasUsersData(cached)) {
          setIncomingRequests(cached.incomingRequests);
          setOutgoingRequests(cached.outgoingRequests);
          setError(null);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const requests = await api.getFriendshipRequests();
        const cached = getFriendshipsCache(ownerKeyId);
        if (cached) {
          setFriendshipsCache(ownerKeyId, {
            ...cached,
            incomingRequests: requests.incoming,
            outgoingRequests: requests.outgoing,
            hasUsersData: true,
          });
        }
        setIncomingRequests(requests.incoming);
        setOutgoingRequests(requests.outgoing);
      } catch (e) {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setError(friendshipRequestErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [api, ownerKeyId],
  );

  useEffect(() => {
    if (!ownerKeyId) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setError(null);
      return;
    }

    const cached = getFriendshipsCache(ownerKeyId);
    if (cached && cacheHasUsersData(cached)) {
      setIncomingRequests(cached.incomingRequests);
      setOutgoingRequests(cached.outgoingRequests);
      setError(null);
    }
  }, [ownerKeyId]);

  return {
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    refresh,
  };
}
