import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function cacheInboxItems(items: InboxApiItem[], replace: boolean) {
  if (replace) {
    manifestCache.clear();
  }
  for (const item of items) {
    manifestCache.set(item.id, item.keyManifest);
  }
}

function mergeInboxItems(
  existing: InboxApiItem[],
  incoming: InboxApiItem[],
): InboxApiItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}

export function useBackendFeedData(keyId: string | null) {
  const api = useFeedApi();
  const [rawItems, setRawItems] = useState<InboxApiItem[]>([]);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedMoreMessageIds, setLoadedMoreMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const loadIdRef = useRef(0);

  const applyInboxPage = useCallback(
    (pageItems: InboxApiItem[], pageTotal: number, replace: boolean) => {
      setTotal(pageTotal);
      setRawItems((current) => {
        const merged = replace
          ? pageItems
          : mergeInboxItems(current, pageItems);
        cacheInboxItems(pageItems, replace);
        const deliveries = inboxApiItemsToStoredDeliveries(merged);
        setMessages(filterFeedInboxMessages(deliveries));
        return merged;
      });
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!keyId) {
      return;
    }

    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await api.getInbox();
      if (loadId !== loadIdRef.current) {
        return;
      }
      applyInboxPage(page.items, page.total, true);
      setLoadedMoreMessageIds(new Set());
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (loadId !== loadIdRef.current) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to load feed data.');
      setRawItems([]);
      setMessages([]);
      setTotal(0);
      setNextCursor(null);
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [api, applyInboxPage, keyId]);

  const loadMore = useCallback(async () => {
    if (!keyId || !nextCursor || loadingMore) {
      return;
    }

    const loadId = loadIdRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await api.getInbox({ cursor: nextCursor });
      if (loadId !== loadIdRef.current) {
        return;
      }
      applyInboxPage(page.items, page.total, false);
      setLoadedMoreMessageIds((current) => {
        const next = new Set(current);
        for (const item of page.items) {
          next.add(item.id);
        }
        return next;
      });
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (loadId !== loadIdRef.current) {
        return;
      }
      setError(
        e instanceof Error ? e.message : 'Failed to load more feed data.',
      );
    } finally {
      if (loadId === loadIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [api, applyInboxPage, keyId, loadingMore, nextCursor]);

  useEffect(() => {
    if (!keyId) {
      loadIdRef.current += 1;
      setRawItems([]);
      setMessages([]);
      setTotal(0);
      setNextCursor(null);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      setLoadedMoreMessageIds(new Set());
      return;
    }

    void reload();
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

  return {
    messages,
    rawItems,
    allDeliveries,
    total,
    hasMore: nextCursor !== null,
    loading,
    loadingMore,
    loadedMoreMessageIds,
    error,
    reload,
    loadMore,
    manifestLookup,
  };
}

export function getCachedKeyManifest(messageId: string) {
  return manifestCache.get(messageId) ?? null;
}

export { manifestCache };
