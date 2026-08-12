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
import { yieldToMain } from '@encrypt/core/utils/yieldToMain';
import type { useFeedntPrivateKey } from '@feednt/hooks/useFeedntPrivateKey.ts';

type KeysSession = ReturnType<typeof useFeedntPrivateKey>;

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

type DecryptFeedContext = Pick<
  DecryptContext,
  'allDeliveries' | 'manifestLookup'
>;

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

async function decryptDeliveriesWithMaterial(
  material: UploadedPrivateKeyMaterial,
  deliveries: StoredFeedDelivery[],
  { allDeliveries, manifestLookup }: DecryptFeedContext,
): Promise<{
  decrypted: Record<string, string>;
  errors: Record<string, string>;
}> {
  const decrypted: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const delivery of deliveries) {
    try {
      decrypted[delivery.id] = await decryptWithMaterial(material, {
        delivery,
        allDeliveries,
        manifestLookup,
      });
    } catch (e) {
      errors[delivery.id] = e instanceof Error ? e.message : 'Decrypt failed.';
    }
    await yieldToMain();
  }

  return { decrypted, errors };
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
    await yieldToMain();
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

export function useBackendDecrypt(keys: KeysSession) {
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
        const commentTexts = await keys.withPrivateKey(async (material) =>
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
    [keys],
  );

  const decryptDeliveries = useCallback(
    async (deliveries: StoredFeedDelivery[], context: DecryptFeedContext) => {
      setMessageErrors({});
      setCommentsErrors({});
      const results = await keys.withPrivateKey(async (material) =>
        decryptDeliveriesWithMaterial(material, deliveries, context),
      );
      if (results === null) {
        return null;
      }
      setDecryptedMessages(results.decrypted);
      setMessageErrors(results.errors);
      return results;
    },
    [keys],
  );

  const decryptDelivery = useCallback(
    async (context: DecryptContext) => {
      const messageId = context.delivery.id;
      setBusyMessageId(messageId);
      setMessageErrors((prev) => withoutKey(prev, messageId));
      setCommentsErrors((prev) => withoutKey(prev, messageId));
      try {
        const messageText = await keys.withPrivateKey(async (material) =>
          decryptWithMaterial(material, context),
        );
        if (messageText === null) {
          return null;
        }
        setDecryptedMessages((prev) => ({
          ...prev,
          [messageId]: messageText,
        }));
        return messageText;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Decrypt failed.';
        setMessageErrors((prev) => ({ ...prev, [messageId]: message }));
        throw e;
      } finally {
        setBusyMessageId(null);
      }
    },
    [keys],
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
    decryptDeliveries,
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
