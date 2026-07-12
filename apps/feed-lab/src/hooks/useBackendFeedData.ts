import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyManifestRecipientPayload } from '@encrypt/core/types/manifest';
import { filterFeedInboxMessages } from '@encrypt/core/utils/feedInboxVisibility';
import type { StoredMessage } from '@encrypt/core/feed/types';
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
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inbox = await api.getInbox();
      cacheInboxItems(inbox);
      setRawItems(inbox);
      const deliveries = inboxApiItemsToStoredDeliveries(inbox);
      setMessages(filterFeedInboxMessages(deliveries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed data.');
      setRawItems([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!keyId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const inbox = await api.getInbox();
        if (cancelled) {
          return;
        }
        cacheInboxItems(inbox);
        setRawItems(inbox);
        const deliveries = inboxApiItemsToStoredDeliveries(inbox);
        setMessages(filterFeedInboxMessages(deliveries));
      } catch (e) {
        if (cancelled) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to load feed data.');
        setRawItems([]);
        setMessages([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, keyId]);

  const manifestLookup = useCallback(
    (messageId: string, keyId: string) =>
      manifestCache.get(messageId)?.[keyId] ?? null,
    [],
  );

  const allDeliveries = useMemo(
    () => inboxApiItemsToStoredDeliveries(rawItems),
    [rawItems],
  );

  return {
    messages,
    rawItems,
    allDeliveries,
    loading,
    error,
    reload,
    manifestLookup,
  };
}

export function getCachedKeyManifest(messageId: string) {
  return manifestCache.get(messageId) ?? null;
}

export { manifestCache };
