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

type ResolvedComments = {
  key: string;
  comments: InboxComment[];
  error: string | null;
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
  refreshKey = 0,
) {
  const queryKey =
    messageId && recipientKeyId
      ? `${messageId}\0${recipientKeyId}\0${refreshKey}`
      : null;

  const [resolved, setResolved] = useState<ResolvedComments | null>(null);

  useEffect(() => {
    if (!queryKey || !messageId || !recipientKeyId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stored = await listCommentsForMessage(messageId);
        const enriched = await enrichComments(stored, recipientKeyId);
        if (!cancelled) {
          setResolved({ key: queryKey, comments: enriched, error: null });
        }
      } catch (e) {
        if (!cancelled) {
          setResolved({
            key: queryKey,
            comments: [],
            error: e instanceof Error ? e.message : 'Failed to load comments.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryKey, messageId, recipientKeyId]);

  const loading = Boolean(queryKey && resolved?.key !== queryKey);
  const comments =
    queryKey && resolved?.key === queryKey ? resolved.comments : [];
  const error = queryKey && resolved?.key === queryKey ? resolved.error : null;

  const loadComments = useCallback(async () => {
    if (!queryKey || !messageId || !recipientKeyId) {
      setResolved(null);
      return;
    }

    try {
      const stored = await listCommentsForMessage(messageId);
      const enriched = await enrichComments(stored, recipientKeyId);
      setResolved({ key: queryKey, comments: enriched, error: null });
    } catch (e) {
      setResolved({
        key: queryKey,
        comments: [],
        error: e instanceof Error ? e.message : 'Failed to load comments.',
      });
    }
  }, [queryKey, messageId, recipientKeyId]);

  const prependComment = useCallback(
    async (comment: StoredComment) => {
      if (!recipientKeyId || comment.messageId !== messageId || !queryKey) {
        return;
      }

      const [inboxComment] = await enrichComments([comment], recipientKeyId);
      if (!inboxComment) {
        return;
      }

      setResolved((prev) => {
        if (!prev || prev.key !== queryKey) {
          return prev;
        }
        if (prev.comments.some((existing) => existing.id === inboxComment.id)) {
          return prev;
        }
        return {
          ...prev,
          comments: [...prev.comments, inboxComment],
        };
      });
    },
    [messageId, recipientKeyId, queryKey],
  );

  return {
    comments,
    loading,
    error,
    reload: loadComments,
    prependComment,
  };
}
