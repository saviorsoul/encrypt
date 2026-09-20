import { isUnknownUserKeyIdError } from '@encrypt/core/utils/apiRegistrationError';
import { yieldToMain } from '@encrypt/core/utils/yieldToMain';
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyManifestRecipientPayload } from '@encrypt/core/types/manifest';
import { filterFeedInboxMessages } from '@encrypt/core/utils/feedInboxVisibility';
import type {
  FeedMessageSortMode,
  InboxCursor,
  StoredMessage,
} from '@encrypt/core/feed/types';
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

function inboxMessagesFromItems(items: InboxApiItem[]): StoredMessage[] {
  return filterFeedInboxMessages(inboxApiItemsToStoredDeliveries(items));
}

const MIN_RELOAD_FEEDBACK_MS = 350;

async function ensureMinReloadFeedbackDuration(
  startedAt: number,
): Promise<void> {
  const remaining = MIN_RELOAD_FEEDBACK_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, remaining);
    });
  }
}

export type UseBackendFeedDataOptions = {
  onEmptyInbox?: () => void;
  sort?: FeedMessageSortMode;
};

export function useBackendFeedData(
  keyId: string | null,
  options?: UseBackendFeedDataOptions,
) {
  const sort = options?.sort ?? 'shareTime';
  const api = useFeedApi();
  const onEmptyInboxRef = useRef(options?.onEmptyInbox);

  useEffect(() => {
    onEmptyInboxRef.current = options?.onEmptyInbox;
  });
  const [rawItems, setRawItems] = useState<InboxApiItem[]>([]);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<InboxCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [loadedMoreMessageIds, setLoadedMoreMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const loadIdRef = useRef(0);
  const rawItemsRef = useRef<InboxApiItem[]>([]);

  useEffect(() => {
    rawItemsRef.current = rawItems;
  }, [rawItems]);

  const applyInboxPage = useCallback(
    async (
      pageItems: InboxApiItem[],
      pageTotal: number | undefined,
      replace: boolean,
      options?: { transition?: boolean },
    ) => {
      await yieldToMain();
      const merged = replace
        ? pageItems
        : mergeInboxItems(rawItemsRef.current, pageItems);
      cacheInboxItems(pageItems, replace);
      const nextMessages = filterFeedInboxMessages(
        inboxApiItemsToStoredDeliveries(merged),
      );

      const commit = () => {
        if (pageTotal !== undefined) {
          setTotal(pageTotal);
        }
        rawItemsRef.current = merged;
        setRawItems(merged);
        setMessages(nextMessages);
      };

      if (options?.transition === false) {
        commit();
        return;
      }

      startTransition(commit);
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!keyId) {
      return;
    }

    const loadId = ++loadIdRef.current;
    const reloadStartedAt = Date.now();
    setLoading(true);
    setError(null);
    setNotRegistered(false);
    await yieldToMain();
    try {
      const page = await api.getInbox({ sort, order: 'desc' });
      if (loadId !== loadIdRef.current) {
        return;
      }
      await applyInboxPage(page.items, page.total, true);
      startTransition(() => {
        setLoadedMoreMessageIds(new Set());
        setNextCursor(page.nextCursor);
        setNotRegistered(false);
      });
      if (inboxMessagesFromItems(page.items).length === 0) {
        onEmptyInboxRef.current?.();
      }
    } catch (e) {
      if (loadId !== loadIdRef.current) {
        return;
      }
      const message =
        e instanceof Error ? e.message : 'Failed to load feed data.';
      startTransition(() => {
        setError(message);
        setNotRegistered(
          keyId != null && isUnknownUserKeyIdError(message, keyId),
        );
        setRawItems([]);
        setMessages([]);
        setTotal(0);
        setNextCursor(null);
      });
    } finally {
      if (loadId === loadIdRef.current) {
        await ensureMinReloadFeedbackDuration(reloadStartedAt);
        setLoading(false);
      }
    }
  }, [api, applyInboxPage, keyId, sort]);

  const loadMore = useCallback(async () => {
    if (!keyId || !nextCursor || loadingMore) {
      return;
    }

    const loadId = loadIdRef.current;
    setLoadingMore(true);
    setError(null);
    await yieldToMain();
    try {
      const page = await api.getInbox({
        cursorSortAt: nextCursor.sortAt,
        cursorThreadId: nextCursor.threadId,
        sort,
        order: 'desc',
      });
      if (loadId !== loadIdRef.current) {
        return;
      }
      await applyInboxPage(page.items, page.total, false, {
        transition: false,
      });
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
  }, [api, applyInboxPage, keyId, loadingMore, nextCursor, sort]);

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
      setNotRegistered(false);
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

  const bumpLastCommentAt = useCallback(
    (messageId: string, createdAt: number) => {
      const lastCommentAtIso = new Date(createdAt).toISOString();
      setRawItems((current) =>
        current.map((item) =>
          item.type === 'message' && item.id === messageId
            ? { ...item, lastCommentAt: lastCommentAtIso }
            : item,
        ),
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, lastCommentAt: createdAt }
            : message,
        ),
      );
    },
    [],
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
    notRegistered,
    reload,
    loadMore,
    manifestLookup,
    bumpLastCommentAt,
  };
}

export function getCachedKeyManifest(messageId: string) {
  return manifestCache.get(messageId) ?? null;
}

export { manifestCache };
