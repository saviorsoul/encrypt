import { useCallback, useState } from 'react';
import { decryptComment } from '@encrypt/core/crypto/commentCrypto';
import {
  decryptSharedStoredMessage,
  isShareDelivery,
} from '@encrypt/core/crypto/manifestShare';
import { resolveParentMessageAccessFromFeed } from '@encrypt/core/feed/access';
import {
  assembleStoredMessagePayloadFromEntry,
  decryptWithManifest,
} from '@encrypt/core/crypto/manifestDecrypt';
import type { KeyManifestRecipientPayload } from '@encrypt/core/types/manifest';
import type {
  StoredComment,
  StoredFeedDelivery,
} from '@encrypt/core/feed/types';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

type WithPrivateKey = ReturnType<typeof usePrivateKeySession>['withPrivateKey'];

type DecryptContext = {
  delivery: StoredFeedDelivery;
  allDeliveries: StoredFeedDelivery[];
  manifestLookup: (
    messageId: string,
    recipientKeyId: string,
  ) => KeyManifestRecipientPayload | null;
};

type DecryptCommentsContext = {
  messageId: string;
  comments: StoredComment[];
  allDeliveries: StoredFeedDelivery[];
  manifestLookup: DecryptContext['manifestLookup'];
};

async function decryptWithMaterial(
  material: UploadedPrivateKeyMaterial,
  { delivery, allDeliveries, manifestLookup }: DecryptContext,
): Promise<string> {
  const recipientKeyId = material.keyId;

  if (!isShareDelivery(delivery)) {
    const access = await resolveParentMessageAccessFromFeed(
      delivery.id,
      recipientKeyId,
      allDeliveries,
      manifestLookup,
    );
    if (!access) {
      throw new Error('No key manifest entry for your key.');
    }

    if (access.deliveryMessageId === delivery.id) {
      const entry = manifestLookup(delivery.id, recipientKeyId);
      if (!entry) {
        throw new Error('Missing key manifest shard.');
      }
      const assembled = assembleStoredMessagePayloadFromEntry(
        delivery.payload,
        recipientKeyId,
        entry,
      );
      return decryptWithManifest(
        assembled,
        material.ecdhPrivateKey,
        recipientKeyId,
      );
    }

    return decryptSharedStoredMessage(
      access.deliveryMessageId,
      access.parentMessageId,
      access.deliveryCorePayloadJson,
      access.parentCorePayloadJson,
      recipientKeyId,
      material.ecdhPrivateKey,
      manifestLookup,
    );
  }

  const parent = allDeliveries.find(
    (row) => row.id === delivery.messageId && !isShareDelivery(row),
  );
  if (!parent || isShareDelivery(parent)) {
    throw new Error('Parent message not found in inbox cache.');
  }

  return decryptSharedStoredMessage(
    delivery.id,
    delivery.messageId,
    delivery.payload,
    parent.payload,
    recipientKeyId,
    material.ecdhPrivateKey,
    manifestLookup,
  );
}

async function decryptCommentsWithMaterial(
  material: UploadedPrivateKeyMaterial,
  comments: StoredComment[],
  allDeliveries: StoredFeedDelivery[],
  manifestLookup: DecryptContext['manifestLookup'],
): Promise<Record<string, string>> {
  const recipientKeyId = material.keyId;
  const decrypted: Record<string, string> = {};

  for (const comment of comments) {
    const access = await resolveParentMessageAccessFromFeed(
      comment.messageId,
      recipientKeyId,
      allDeliveries,
      manifestLookup,
    );
    if (!access) {
      continue;
    }

    try {
      decrypted[comment.id] = await decryptComment(
        comment.payload,
        comment.messageId,
        access,
        recipientKeyId,
        material.ecdhPrivateKey,
        manifestLookup,
      );
    } catch {
      // Skip comments that cannot be decrypted with this key.
    }
  }

  return decrypted;
}

function withoutKey<T extends Record<string, unknown>>(map: T, key: string): T {
  if (!(key in map)) {
    return map;
  }
  const next = { ...map };
  delete next[key];
  return next;
}

function commentThreadId(delivery: StoredFeedDelivery): string {
  return isShareDelivery(delivery) ? delivery.messageId : delivery.id;
}

export function useBackendDecrypt(withPrivateKey: WithPrivateKey) {
  const api = useFeedApi();
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<
    Record<string, string>
  >({});
  const [messageErrors, setMessageErrors] = useState<Record<string, string>>(
    {},
  );
  const [decryptedCommentsByMessage, setDecryptedCommentsByMessage] = useState<
    Record<string, Record<string, string>>
  >({});
  const [commentsErrors, setCommentsErrors] = useState<Record<string, string>>(
    {},
  );

  const decryptComments = useCallback(
    async (context: DecryptCommentsContext) => {
      const { messageId } = context;
      setCommentsErrors((prev) => withoutKey(prev, messageId));
      try {
        const commentTexts = await withPrivateKey(async (material) =>
          decryptCommentsWithMaterial(
            material,
            context.comments,
            context.allDeliveries,
            context.manifestLookup,
          ),
        );
        if (commentTexts === null) {
          return null;
        }
        setDecryptedCommentsByMessage((prev) => ({
          ...prev,
          [messageId]: commentTexts,
        }));
        return commentTexts;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to decrypt comments.';
        setCommentsErrors((prev) => ({ ...prev, [messageId]: message }));
        throw e;
      }
    },
    [withPrivateKey],
  );

  const decryptDelivery = useCallback(
    async (context: DecryptContext) => {
      const messageId = context.delivery.id;
      const threadId = commentThreadId(context.delivery);
      setBusyMessageId(messageId);
      setMessageErrors((prev) => withoutKey(prev, messageId));
      setCommentsErrors((prev) => withoutKey(prev, messageId));
      try {
        const result = await withPrivateKey(async (material) => {
          const messageText = await decryptWithMaterial(material, context);
          try {
            const comments = await api.getComments(threadId);
            const commentTexts = await decryptCommentsWithMaterial(
              material,
              comments,
              context.allDeliveries,
              context.manifestLookup,
            );
            return { messageText, commentTexts, commentsError: null };
          } catch (e) {
            const commentsError =
              e instanceof Error ? e.message : 'Failed to load comments.';
            return { messageText, commentTexts: null, commentsError };
          }
        });
        if (result === null) {
          return null;
        }
        setDecryptedMessages((prev) => ({
          ...prev,
          [messageId]: result.messageText,
        }));
        if (result.commentTexts !== null) {
          setDecryptedCommentsByMessage((prev) => ({
            ...prev,
            [messageId]: result.commentTexts,
          }));
        }
        if (result.commentsError) {
          setCommentsErrors((prev) => ({
            ...prev,
            [messageId]: result.commentsError,
          }));
        }
        return result.messageText;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Decrypt failed.';
        setMessageErrors((prev) => ({ ...prev, [messageId]: message }));
        throw e;
      } finally {
        setBusyMessageId(null);
      }
    },
    [api, withPrivateKey],
  );

  const clear = useCallback(() => {
    setBusyMessageId(null);
    setDecryptedMessages({});
    setMessageErrors({});
    setDecryptedCommentsByMessage({});
    setCommentsErrors({});
  }, []);

  const mergeDecryptedComments = useCallback(
    (messageId: string, updates: Record<string, string>) => {
      setDecryptedCommentsByMessage((prev) => ({
        ...prev,
        [messageId]: { ...(prev[messageId] ?? {}), ...updates },
      }));
    },
    [],
  );

  return {
    decryptDelivery,
    decryptComments,
    busyMessageId,
    decryptedMessages,
    messageErrors,
    decryptedCommentsByMessage,
    commentsErrors,
    clear,
    mergeDecryptedComments,
  };
}
