import type { InboxApiItem } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import type { StoredFeedDelivery } from '@encrypt/core/feed/types';
import {
  getManifestEntry,
  getManifestEntryForDelivery,
  listDeliveryIdsForRecipientKeyId,
} from './manifestShards.js';
import { getMessageById } from './messages.js';
import { getShareById } from './shares.js';

async function buildKeyManifestForParent(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<KeyManifestMap> {
  const entry = await getManifestEntry(parentMessageId, recipientKeyId);
  if (!entry) {
    return {};
  }

  return { [recipientKeyId]: entry };
}

export async function listDeliveriesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredFeedDelivery[]> {
  const deliveryIds = await listDeliveryIdsForRecipientKeyId(recipientKeyId);
  const deliveries: StoredFeedDelivery[] = [];
  const existingIds = new Set<string>();

  for (const id of deliveryIds) {
    const message = await getMessageById(id);
    if (message) {
      deliveries.push(message);
      existingIds.add(id);
      continue;
    }

    const share = await getShareById(id);
    if (share) {
      deliveries.push(share);
      existingIds.add(id);
    }
  }

  const parentIds = new Set<string>();
  for (const delivery of deliveries) {
    if ('messageId' in delivery) {
      parentIds.add(delivery.messageId);
    }
  }

  for (const parentId of parentIds) {
    if (existingIds.has(parentId)) {
      continue;
    }
    const parent = await getMessageById(parentId);
    if (parent) {
      deliveries.push(parent);
      existingIds.add(parentId);
    }
  }

  return deliveries.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listInboxItemsForRecipientKeyId(
  recipientKeyId: string,
): Promise<InboxApiItem[]> {
  const deliveries = await listDeliveriesForRecipientKeyId(recipientKeyId);
  const items: InboxApiItem[] = [];

  const accessibleShareParentIds = new Set<string>();
  for (const delivery of deliveries) {
    if (!('messageId' in delivery)) {
      continue;
    }
    const shareKeyManifest = await buildKeyManifestForParent(
      delivery.messageId,
      recipientKeyId,
    );
    if (Object.keys(shareKeyManifest).length > 0) {
      accessibleShareParentIds.add(delivery.messageId);
    }
  }

  for (const delivery of deliveries) {
    const parentMessageId =
      'messageId' in delivery ? delivery.messageId : delivery.id;
    const keyManifest = await buildKeyManifestForParent(
      parentMessageId,
      recipientKeyId,
    );

    const isShare = 'messageId' in delivery;
    const includeParentForShareAccess =
      !isShare &&
      Object.keys(keyManifest).length === 0 &&
      accessibleShareParentIds.has(delivery.id);

    if (Object.keys(keyManifest).length === 0 && !includeParentForShareAccess) {
      continue;
    }

    if (isShare) {
      items.push({
        id: delivery.id,
        type: 'share',
        messageId: delivery.messageId,
        payload: delivery.payload,
        createdAt: new Date(delivery.createdAt).toISOString(),
        keyManifest,
      });
      continue;
    }

    items.push({
      id: delivery.id,
      type: 'message',
      payload: delivery.payload,
      createdAt: new Date(delivery.createdAt).toISOString(),
      keyManifest: includeParentForShareAccess ? {} : keyManifest,
    });
  }

  return items;
}

export function createManifestLookup(
  recipientKeyId: string,
): (
  messageId: string,
  keyId: string,
) => Promise<KeyManifestMap[string] | null> {
  return async (deliveryMessageId, keyId) => {
    if (keyId !== recipientKeyId) {
      return null;
    }
    return getManifestEntryForDelivery(deliveryMessageId, recipientKeyId);
  };
}
