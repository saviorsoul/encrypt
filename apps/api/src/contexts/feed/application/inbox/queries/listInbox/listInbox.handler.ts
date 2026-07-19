import type {
  InboxApiItem,
  StoredFeedDelivery,
} from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { logger } from '@/lib/logger.js';
import { manifestShardRepository } from '@/contexts/feed/infrastructure/prismaManifestShardRepository.js';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';
import { shareRepository } from '@/contexts/feed/infrastructure/prismaShareRepository.js';
import type { ListInboxQuery } from './listInbox.query.js';

async function buildDirectKeyManifestForParent(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<KeyManifestMap> {
  const entry = await manifestShardRepository.getManifestEntry(
    parentMessageId,
    recipientKeyId,
  );
  if (!entry) {
    return {};
  }

  return { [recipientKeyId]: entry };
}

async function buildKeyManifestForDelivery(
  deliveryId: string,
  recipientKeyId: string,
): Promise<KeyManifestMap> {
  const entry = await manifestShardRepository.getManifestEntryForDelivery(
    deliveryId,
    recipientKeyId,
  );
  if (!entry) {
    return {};
  }

  return { [recipientKeyId]: entry };
}

async function listDeliveriesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredFeedDelivery[]> {
  const deliveryIds =
    await manifestShardRepository.listDeliveryIdsForRecipientKeyId(
      recipientKeyId,
    );
  const byId = new Map<string, StoredFeedDelivery>();

  for (const id of deliveryIds) {
    if (byId.has(id)) {
      continue;
    }

    const message = await messageRepository.getById(id);
    if (message) {
      byId.set(id, message);
      continue;
    }

    const share = await shareRepository.getById(id);
    if (!share) {
      // Manifest shards should always point at a message or share row.
      logger.error(
        { deliveryId: id, recipientKeyId },
        'inbox delivery id has no message or share row',
      );
      continue;
    }

    byId.set(id, share);

    if (!byId.has(share.messageId)) {
      const parent = await messageRepository.getById(share.messageId);
      if (parent) {
        byId.set(parent.id, parent);
      } else {
        logger.error(
          {
            shareId: share.id,
            messageId: share.messageId,
            recipientKeyId,
          },
          'inbox share is missing parent message',
        );
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function handleListInbox(
  query: ListInboxQuery,
): Promise<InboxApiItem[]> {
  const { recipientKeyId } = query;
  const deliveries = await listDeliveriesForRecipientKeyId(recipientKeyId);
  const items: InboxApiItem[] = [];

  const accessibleShareParentIds = new Set<string>();
  for (const delivery of deliveries) {
    if (!('messageId' in delivery)) {
      continue;
    }
    const shareKeyManifest = await buildKeyManifestForDelivery(
      delivery.id,
      recipientKeyId,
    );
    if (Object.keys(shareKeyManifest).length > 0) {
      accessibleShareParentIds.add(delivery.messageId);
    }
  }

  for (const delivery of deliveries) {
    const isShare = 'messageId' in delivery;
    const keyManifest = isShare
      ? await buildKeyManifestForDelivery(delivery.id, recipientKeyId)
      : await buildDirectKeyManifestForParent(delivery.id, recipientKeyId);
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
