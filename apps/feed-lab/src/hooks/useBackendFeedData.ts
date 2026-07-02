import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyManifestRecipientPayload } from '@encrypt/core/types/manifest';
import { filterFeedInboxMessages } from '@encrypt/core/utils/feedInboxVisibility';
import type { StoredComment, StoredMessage } from '@encrypt/core/feed/types';
import {
  inboxApiItemsToStoredDeliveries,
  type InboxApiItem,
} from '@encrypt/core/feed/types';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

const manifestCache = new Map<
  string,
  Record<string, KeyManifestRecipientPayload>
>();

function cacheInboxItems(items: InboxApiItem[]) {
  manifestCache.clear();
  for (const item of items) {
    manifestCache.set(item.id, item.keyManifest);
  }
}

export function useBackendFeedData(keyId: string | null) {
  const api = useFeedApi();
  const [rawItems, setRawItems] = useState<InboxApiItem[]>([]);
  const [commentsByMessageId, setCommentsByMessageId] = useState<
    Record<string, StoredComment[]>
  >({});
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAllFeedData();
      cacheInboxItems(data.inbox);
      setRawItems(data.inbox);
      setCommentsByMessageId(data.commentsByMessageId);
      const deliveries = inboxApiItemsToStoredDeliveries(data.inbox);
      setMessages(filterFeedInboxMessages(deliveries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed data.');
      setRawItems([]);
      setMessages([]);
      setCommentsByMessageId({});
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (keyId) {
      void reload();
    }
  }, [keyId, reload]);

  const manifestLookup = useCallback(
    (messageId: string, keyId: string) =>
      manifestCache.get(messageId)?.[keyId] ?? null,
    [],
  );

  const allDeliveries = useMemo(
    () => inboxApiItemsToStoredDeliveries(rawItems),
    [rawItems],
  );

  const totalComments = useMemo(
    () =>
      Object.values(commentsByMessageId).reduce(
        (sum, rows) => sum + rows.length,
        0,
      ),
    [commentsByMessageId],
  );

  return {
    messages,
    rawItems,
    allDeliveries,
    commentsByMessageId,
    totalComments,
    loading,
    error,
    reload,
    manifestLookup,
  };
}

export { manifestCache };
