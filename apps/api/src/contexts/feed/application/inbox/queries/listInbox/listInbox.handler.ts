import type { InboxApiItem, InboxPageResponse } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { logger } from '@/lib/logger.js';
import type { InboxDeliveryRef } from '@/contexts/feed/domain/ports/InboxRepository.js';
import { inboxRepository } from '@/contexts/feed/infrastructure/prismaInboxRepository.js';
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

async function buildInboxItemForDelivery(
  delivery: InboxDeliveryRef,
  recipientKeyId: string,
): Promise<InboxApiItem | null> {
  if (delivery.kind === 'share') {
    const share = await shareRepository.getById(delivery.id);
    if (!share) {
      logger.error(
        { deliveryId: delivery.id, recipientKeyId },
        'inbox share delivery is missing share row',
      );
      return null;
    }

    const keyManifest = await buildKeyManifestForDelivery(
      delivery.id,
      recipientKeyId,
    );
    if (Object.keys(keyManifest).length === 0) {
      return null;
    }

    return {
      id: share.id,
      type: 'share',
      messageId: share.messageId,
      payload: share.payload,
      createdAt: new Date(share.createdAt).toISOString(),
      keyManifest,
    };
  }

  const message = await messageRepository.getById(delivery.id);
  if (!message) {
    logger.error(
      { deliveryId: delivery.id, recipientKeyId },
      'inbox message delivery is missing message row',
    );
    return null;
  }

  const keyManifest = await buildDirectKeyManifestForParent(
    delivery.id,
    recipientKeyId,
  );
  const includeParentForShareAccess =
    Object.keys(keyManifest).length === 0 &&
    (await inboxRepository.recipientHasShareAccessToParent(
      delivery.id,
      recipientKeyId,
    ));

  if (Object.keys(keyManifest).length === 0 && !includeParentForShareAccess) {
    return null;
  }

  return {
    id: message.id,
    type: 'message',
    payload: message.payload,
    createdAt: new Date(message.createdAt).toISOString(),
    keyManifest: includeParentForShareAccess ? {} : keyManifest,
  };
}

export async function handleListInbox(
  query: ListInboxQuery,
): Promise<InboxPageResponse> {
  const { recipientKeyId, cursor, limit, sort, order } = query;

  const [total, page] = await Promise.all([
    inboxRepository.countDeliveries({ recipientKeyId, sort, order }),
    inboxRepository.listDeliveries({
      recipientKeyId,
      limit,
      cursor,
      sort,
      order,
    }),
  ]);

  const items: InboxApiItem[] = [];
  for (const delivery of page.deliveries) {
    const item = await buildInboxItemForDelivery(delivery, recipientKeyId);
    if (item) {
      items.push(item);
    }
  }

  return {
    items,
    total,
    nextCursor: page.nextCursor,
  };
}
