import { useCallback, useEffect, useState } from 'react';
import {
  commentVisibleToRecipient,
  listCommentsForMessage,
  type StoredComment,
} from '@/services/db/storedComments.ts';
import { getCommentAuthorKeyIdFromPayload } from '@/crypto/commentCrypto.ts';
import { listStoredUsers } from '@/services/db/storedPublicKeys.ts';

export type InboxComment = StoredComment & {
  authorLabel: string;
};

async function enrichComments(
  comments: StoredComment[],
  recipientKeyId: string,
): Promise<InboxComment[]> {
  const users = await listStoredUsers();
  const usernameByKeyId = new Map(
    users.map((user) => [user.keyId, user.username]),
  );

  const enriched = await Promise.all(
    comments.map(async (comment) => {
      const visible = await commentVisibleToRecipient(
        comment.messageId,
        comment.payload,
        recipientKeyId,
      );
      if (!visible) {
        return null;
      }

      const authorKeyId = await getCommentAuthorKeyIdFromPayload(
        comment.payload,
      );
      const authorLabel =
        (authorKeyId && usernameByKeyId.get(authorKeyId)) ||
        (authorKeyId ? `${authorKeyId.slice(0, 12)}…` : 'Unknown author');

      return {
        ...comment,
        authorLabel,
      };
    }),
  );

  return enriched
    .filter((comment): comment is InboxComment => comment !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function useMessageComments(
  messageId: string | null,
  recipientKeyId: string | null,
) {
  const [comments, setComments] = useState<InboxComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);

  const loadKey =
    messageId && recipientKeyId ? `${messageId}\0${recipientKeyId}` : null;

  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    if (!loadKey) {
      setComments([]);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
  }

  useEffect(() => {
    if (!messageId || !recipientKeyId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stored = await listCommentsForMessage(messageId);
        const enriched = await enrichComments(stored, recipientKeyId);
        if (!cancelled) {
          setComments(enriched);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load comments.');
          setComments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messageId, recipientKeyId]);

  const loadComments = useCallback(async () => {
    if (!messageId || !recipientKeyId) {
      setComments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const stored = await listCommentsForMessage(messageId);
      const enriched = await enrichComments(stored, recipientKeyId);
      setComments(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments.');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [messageId, recipientKeyId]);

  const prependComment = useCallback(
    async (comment: StoredComment) => {
      if (!recipientKeyId || comment.messageId !== messageId) {
        return;
      }

      const [inboxComment] = await enrichComments([comment], recipientKeyId);
      if (!inboxComment) {
        return;
      }

      setComments((prev) => {
        if (prev.some((existing) => existing.id === inboxComment.id)) {
          return prev;
        }
        return [...prev, inboxComment];
      });
    },
    [messageId, recipientKeyId],
  );

  return {
    comments,
    loading,
    error,
    reload: loadComments,
    prependComment,
  };
}
