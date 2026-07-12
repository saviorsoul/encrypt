import { useCallback, useEffect, useState } from 'react';
import type { FriendshipRequest } from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

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

  const refresh = useCallback(async () => {
    if (!ownerKeyId) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const requests = await api.getFriendshipRequests();
      setIncomingRequests(requests.incoming);
      setOutgoingRequests(requests.outgoing);
    } catch (e) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setError(
        e instanceof Error ? e.message : 'Failed to load friendship requests.',
      );
    } finally {
      setLoading(false);
    }
  }, [api, ownerKeyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    refresh,
  };
}
