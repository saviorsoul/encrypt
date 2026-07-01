import type { InboxApiItem } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import type { StoredFeedDelivery } from '@encrypt/core/feed/types';
import {
  getManifestEntry,
  listMessageIdsForRecipientKeyId,
} from './manifestShards.js';
import { getMessageById } from './messages.js';
import { getShareById } from './shares.js';

async function buildKeyManifestForRecipient(
  messageId: string,
  recipientKeyId: string,
): Promise<KeyManifestMap> {
  const entry = await getManifestEntry(messageId, recipientKeyId);
  if (!entry) {
    return {};
  }

  return { [recipientKeyId]: entry };
}

export async function listDeliveriesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredFeedDelivery[]> {
  const messageIds = await listMessageIdsForRecipientKeyId(recipientKeyId);
  const deliveries: StoredFeedDelivery[] = [];
  const existingIds = new Set<string>();

  for (const id of messageIds) {
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

  for (const delivery of deliveries) {
    const keyManifest = await buildKeyManifestForRecipient(
      delivery.id,
      recipientKeyId,
    );

    if (Object.keys(keyManifest).length === 0) {
      continue;
    }

    if ('messageId' in delivery) {
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
      keyManifest,
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
  return async (messageId, keyId) => {
    if (keyId !== recipientKeyId) {
      return null;
    }
    return getManifestEntry(messageId, recipientKeyId);
  };
}
