export * from '@encrypt/core/crypto/manifestShare';

import {
  buildManifestShareWithAccess,
  decryptParentMessageDekFromAccess,
  decryptSharedStoredMessage,
  getSharerKeyIdFromSharePayload,
  isShareDelivery,
} from '@encrypt/core/crypto/manifestShare';
import { resolveParentMessageAccessFromFeed } from '@encrypt/core/feed/access';
import type { ParentMessageAccess } from '@encrypt/core/feed/access';
import {
  assembleStoredMessagePayloadFromEntry,
  decryptWithManifest,
  getSenderKeyIdFromCorePayload,
} from '@encrypt/core/crypto/manifestDecrypt';
import type { ManifestRecipientKeys } from '@encrypt/core/crypto/manifestEncrypt';
import {
  getMessageKeyManifestEntry,
  hasMessageKeyManifestShard,
} from '@/services/db/storedMessageKeyManifest.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';
import type { StoredShare } from '@/services/db/storedShares.ts';
import { getStoredMessageById } from '@/services/db/storedMessages.ts';
import { listShareDeliveriesForMessage } from '@/services/db/storedShares.ts';
import type { StoredFeedDelivery } from '@/services/db/storedMessages.ts';

export type { ParentMessageAccess };

async function listDeliveriesForAccess(
  parentMessageId: string,
): Promise<StoredFeedDelivery[]> {
  const parent = await getStoredMessageById(parentMessageId);
  if (!parent) {
    return [];
  }
  const shares = await listShareDeliveriesForMessage(parentMessageId);
  return [parent, ...shares];
}

export async function buildManifestShare(
  parentMessageId: string,
  sharerKeyId: string,
  sharerPrivateKey: CryptoKey,
  sharerPublicKey: CryptoKey,
  sharerSigningPrivateKey: CryptoKey,
  newRecipients: ManifestRecipientKeys[],
) {
  const deliveries = await listDeliveriesForAccess(parentMessageId);
  const access = await resolveParentMessageAccessFromFeed(
    parentMessageId,
    sharerKeyId,
    deliveries,
    (messageId, keyId) => getMessageKeyManifestEntry(messageId, keyId),
  );
  if (!access) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return buildManifestShareWithAccess(
    access,
    sharerKeyId,
    sharerPrivateKey,
    sharerPublicKey,
    sharerSigningPrivateKey,
    newRecipients,
    (messageId, keyId) => getMessageKeyManifestEntry(messageId, keyId),
  );
}

export async function decryptStoredDeliveryWithPrivateKey(
  delivery: StoredMessage | StoredShare,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<string> {
  if (!isShareDelivery(delivery)) {
    const access = await resolveParentMessageAccess(
      delivery.id,
      recipientKeyId,
    );
    if (!access) {
      throw new Error(
        'No key manifest entry for the given recipientKeyId (wrong key pair?).',
      );
    }

    if (access.deliveryMessageId === delivery.id) {
      const entry = await getMessageKeyManifestEntry(
        delivery.id,
        recipientKeyId,
      );
      if (!entry) {
        throw new Error(
          'No key manifest entry for the given recipientKeyId (wrong key pair?).',
        );
      }
      const assembledPayload = assembleStoredMessagePayloadFromEntry(
        delivery.payload,
        recipientKeyId,
        entry,
      );
      return decryptWithManifest(
        assembledPayload,
        recipientPrivateKey,
        recipientKeyId,
      );
    }

    return decryptSharedStoredMessage(
      access.deliveryMessageId,
      access.parentMessageId,
      access.deliveryCorePayloadJson,
      access.parentCorePayloadJson,
      recipientKeyId,
      recipientPrivateKey,
      (messageId, keyId) => getMessageKeyManifestEntry(messageId, keyId),
    );
  }

  const parent = await getStoredMessageById(delivery.messageId);
  if (!parent) {
    throw new Error(`Parent message not found: ${delivery.messageId}`);
  }

  return decryptSharedStoredMessage(
    delivery.id,
    delivery.messageId,
    delivery.payload,
    parent.payload,
    recipientKeyId,
    recipientPrivateKey,
    (messageId, keyId) => getMessageKeyManifestEntry(messageId, keyId),
  );
}

export async function resolveParentMessageAccess(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<ParentMessageAccess | null> {
  const deliveries = await listDeliveriesForAccess(parentMessageId);
  return await resolveParentMessageAccessFromFeed(
    parentMessageId,
    recipientKeyId,
    deliveries,
    (messageId, keyId) => getMessageKeyManifestEntry(messageId, keyId),
  );
}

export async function getSharerKeyIdForRecipientParentAccess(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<string | null> {
  const access = await resolveParentMessageAccess(
    parentMessageId,
    recipientKeyId,
  );
  if (!access || access.deliveryMessageId === parentMessageId) {
    return null;
  }

  return getSharerKeyIdFromSharePayload(access.deliveryCorePayloadJson);
}

export async function recipientHasAccessToParentMessage(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<boolean> {
  return (
    (await resolveParentMessageAccess(parentMessageId, recipientKeyId)) !== null
  );
}

export async function canCommentOnParentMessage(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<boolean> {
  const parent = await getStoredMessageById(parentMessageId);
  if (!parent) {
    return false;
  }

  const senderKeyId = await getSenderKeyIdFromCorePayload(parent.payload);
  if (senderKeyId === recipientKeyId) {
    return true;
  }

  return recipientHasAccessToParentMessage(parentMessageId, recipientKeyId);
}

export async function decryptParentMessageDekForRecipient(
  parentMessageId: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<ArrayBuffer> {
  const access = await resolveParentMessageAccess(
    parentMessageId,
    recipientKeyId,
  );
  if (!access) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }

  return decryptParentMessageDekFromAccess(
    access,
    recipientKeyId,
    recipientPrivateKey,
    (messageId, keyId) => getMessageKeyManifestEntry(messageId, keyId),
  );
}

export { hasMessageKeyManifestShard };
