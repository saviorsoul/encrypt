import { useCallback, useEffect, useState } from 'react';
import {
  commentVisibleToRecipient,
  listCommentsForMessage,
} from '@/crypto/storedComments.ts';

async function countVisibleCommentsForMessage(
  messageId: string,
  recipientKeyId: string,
): Promise<number> {
  const comments = await listCommentsForMessage(messageId);
  const arrAreCommentsVisible = await Promise.all(
    comments.map((comment) =>
      commentVisibleToRecipient(messageId, comment.payload, recipientKeyId),
    ),
  );
  return arrAreCommentsVisible.filter((isVisible) => isVisible).length;
}

function messageIdsFromKey(messageIdsKey: string): string[] {
  return messageIdsKey.length === 0 ? [] : messageIdsKey.split('\0');
}

function commentCountsEqual(
  prev: Record<string, number>,
  next: Record<string, number>,
): boolean {
  const nextKeys = Object.keys(next);
  if (Object.keys(prev).length !== nextKeys.length) {
    return false;
  }
  return nextKeys.every((key) => prev[key] === next[key]);
}

async function loadCommentCountsForMessageIds(
  ids: string[],
  recipientKeyId: string,
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    ids.map(async (messageId) => {
      const count = await countVisibleCommentsForMessage(
        messageId,
        recipientKeyId,
      );
      return [messageId, count] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export function useMessageCommentCounts(
  messageIds: string[],
  recipientKeyId: string | null,
) {
  const [commentCountByMessageId, setCommentCountByMessageId] = useState<
    Record<string, number>
  >({});
  const [prevCountKey, setPrevCountKey] = useState('');

  const messageIdsKey = messageIds.join('\0');
  const countKey = `${recipientKeyId ?? ''}\0${messageIdsKey}`;

  if (countKey !== prevCountKey) {
    setPrevCountKey(countKey);
    if (!recipientKeyId || messageIds.length === 0) {
      setCommentCountByMessageId((prev) =>
        Object.keys(prev).length === 0 ? prev : {},
      );
    }
  }

  useEffect(() => {
    const ids = messageIdsFromKey(messageIdsKey);

    if (!recipientKeyId || ids.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const next = await loadCommentCountsForMessageIds(ids, recipientKeyId);
      if (cancelled) {
        return;
      }
      setCommentCountByMessageId((prev) =>
        commentCountsEqual(prev, next) ? prev : next,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [messageIdsKey, recipientKeyId]);

  const loadCounts = useCallback(async () => {
    const ids = messageIdsFromKey(messageIdsKey);

    if (!recipientKeyId || ids.length === 0) {
      setCommentCountByMessageId((prev) =>
        Object.keys(prev).length === 0 ? prev : {},
      );
      return;
    }

    const next = await loadCommentCountsForMessageIds(ids, recipientKeyId);
    setCommentCountByMessageId((prev) =>
      commentCountsEqual(prev, next) ? prev : next,
    );
  }, [messageIdsKey, recipientKeyId]);

  const incrementCommentCount = useCallback((messageId: string) => {
    setCommentCountByMessageId((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] ?? 0) + 1,
    }));
  }, []);

  return {
    commentCountByMessageId,
    incrementCommentCount,
    reloadCommentCounts: loadCounts,
  };
}
