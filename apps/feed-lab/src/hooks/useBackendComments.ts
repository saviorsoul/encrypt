import { useCallback, useEffect, useState } from 'react';
import {
  decryptComment,
  encryptCommentWithMessageKey,
  getCommentAuthorKeyIdFromPayload,
} from '@encrypt/core/crypto/commentCrypto';
import { resolveParentMessageAccessFromFeed } from '@encrypt/core/feed/access';
import type { StoredComment } from '@encrypt/core/feed/types';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type WithPrivateKey = ReturnType<typeof usePrivateKeySession>['withPrivateKey'];

type CommentContext = {
  allDeliveries: Parameters<typeof resolveParentMessageAccessFromFeed>[2];
  manifestLookup: Parameters<typeof resolveParentMessageAccessFromFeed>[3];
};

export function useBackendComments(
  messageId: string | null,
  recipientKeyId: string | null,
  withPrivateKey: WithPrivateKey,
) {
  const api = useFeedApi();
  const [comments, setComments] = useState<StoredComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postBusy, setPostBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!messageId) {
      setComments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setComments(await api.getComments(messageId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments.');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [api, messageId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const postComment = useCallback(
    async ({
      messageId: threadId,
      allDeliveries,
      manifestLookup,
      text,
    }: CommentContext & { messageId: string; text: string }) => {
      setPostBusy(true);
      setError(null);
      try {
        const posted = await withPrivateKey(async (material) => {
          const access = await resolveParentMessageAccessFromFeed(
            threadId,
            material.keyId,
            allDeliveries,
            manifestLookup,
          );
          if (!access) {
            throw new Error('You cannot comment on this message.');
          }

          const payloadJson = await encryptCommentWithMessageKey(
            text,
            threadId,
            access,
            material.keyId,
            material.ecdhPrivateKey,
            material.senderPublicKey,
            material.ecdsaSignPrivateKey,
            manifestLookup,
          );
          const payload = JSON.parse(payloadJson) as Record<string, unknown>;
          await api.postComment(payload);
          return true;
        });
        if (!posted) {
          return;
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to post comment.');
      } finally {
        setPostBusy(false);
      }
    },
    [api, reload, withPrivateKey],
  );

  const decryptCommentText = useCallback(
    async (comment: StoredComment, context: CommentContext) => {
      return withPrivateKey(async (material) => {
        const access = await resolveParentMessageAccessFromFeed(
          comment.messageId,
          material.keyId,
          context.allDeliveries,
          context.manifestLookup,
        );
        if (!access) {
          throw new Error('Cannot decrypt comment — no message access.');
        }
        return decryptComment(
          comment.payload,
          comment.messageId,
          access,
          material.keyId,
          material.ecdhPrivateKey,
          context.manifestLookup,
        );
      });
    },
    [withPrivateKey],
  );

  return {
    comments,
    loading,
    error,
    postBusy,
    reload,
    postComment,
    decryptCommentText,
    getCommentAuthorKeyIdFromPayload,
  };
}
