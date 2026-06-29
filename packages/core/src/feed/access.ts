import type { KeyManifestRecipientPayload } from '../types/manifest.ts';
import type { StoredFeedDelivery, StoredMessage } from './types.ts';
import { isShareDelivery } from '../crypto/manifestShare.ts';

export type ParentMessageAccess = {
  parentMessageId: string;
  parentCorePayloadJson: string;
  deliveryMessageId: string;
  deliveryCorePayloadJson: string;
};

export type KeyManifestLookup = (
  messageId: string,
  recipientKeyId: string,
) =>
  | KeyManifestRecipientPayload
  | null
  | undefined
  | Promise<KeyManifestRecipientPayload | null | undefined>;

async function resolveLookup(
  lookup: KeyManifestLookup,
  messageId: string,
  recipientKeyId: string,
): Promise<KeyManifestRecipientPayload | null | undefined> {
  return await Promise.resolve(lookup(messageId, recipientKeyId));
}

async function hasManifestShard(
  lookup: KeyManifestLookup,
  messageId: string,
  recipientKeyId: string,
): Promise<boolean> {
  return (await resolveLookup(lookup, messageId, recipientKeyId)) != null;
}

/** Resolve parent DEK access from in-memory feed rows (API inbox or local store). */
export async function resolveParentMessageAccessFromFeed(
  parentMessageId: string,
  recipientKeyId: string,
  deliveries: StoredFeedDelivery[],
  lookup: KeyManifestLookup,
): Promise<ParentMessageAccess | null> {
  const parent = deliveries.find(
    (row): row is StoredMessage =>
      row.id === parentMessageId && !isShareDelivery(row),
  );
  if (!parent) {
    return null;
  }

  if (await hasManifestShard(lookup, parentMessageId, recipientKeyId)) {
    return {
      parentMessageId,
      parentCorePayloadJson: parent.payload,
      deliveryMessageId: parentMessageId,
      deliveryCorePayloadJson: parent.payload,
    };
  }

  for (const delivery of deliveries) {
    if (
      isShareDelivery(delivery) &&
      delivery.messageId === parentMessageId &&
      (await hasManifestShard(lookup, delivery.id, recipientKeyId))
    ) {
      return {
        parentMessageId,
        parentCorePayloadJson: parent.payload,
        deliveryMessageId: delivery.id,
        deliveryCorePayloadJson: delivery.payload,
      };
    }
  }

  return null;
}

export async function recipientHasAccessToParentFromFeed(
  parentMessageId: string,
  recipientKeyId: string,
  deliveries: StoredFeedDelivery[],
  lookup: KeyManifestLookup,
): Promise<boolean> {
  return (
    (await resolveParentMessageAccessFromFeed(
      parentMessageId,
      recipientKeyId,
      deliveries,
      lookup,
    )) !== null
  );
}

export async function getManifestEntryOrThrow(
  lookup: KeyManifestLookup,
  messageId: string,
  recipientKeyId: string,
): Promise<KeyManifestRecipientPayload> {
  const entry = await resolveLookup(lookup, messageId, recipientKeyId);
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return entry;
}
