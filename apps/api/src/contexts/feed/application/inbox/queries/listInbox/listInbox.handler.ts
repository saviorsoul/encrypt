import type { InboxApiItem, InboxPageResponse } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { logger } from '@/lib/logger.js';
import type { InboxPageThread } from '@/contexts/feed/domain/ports/InboxRepository.js';
import { inboxRepository } from '@/contexts/feed/infrastructure/prismaInboxRepository.js';
import type { ListInboxQuery } from './listInbox.query.js';

function parseKeyManifestEntry(
  thread: InboxPageThread,
  recipientKeyId: string,
): KeyManifestMap | null {
  try {
    return {
      [recipientKeyId]: JSON.parse(thread.entryJson) as KeyManifestMap[string],
    };
  } catch (error) {
    logger.error(
      { threadId: thread.threadId, recipientKeyId, error },
      'inbox thread has invalid manifest entry json',
    );
    return null;
  }
}

function mapThreadToInboxItems(
  thread: InboxPageThread,
  recipientKeyId: string,
): InboxApiItem[] {
  const keyManifest = parseKeyManifestEntry(thread, recipientKeyId);
  if (keyManifest == null) {
    return [];
  }

  if (thread.shareId != null) {
    if (thread.sharePayload == null || thread.shareCreatedAt == null) {
      logger.error(
        { threadId: thread.threadId, shareId: thread.shareId, recipientKeyId },
        'inbox share delivery is missing share row',
      );
      return [];
    }

    return [
      {
        id: thread.shareId,
        type: 'share',
        messageId: thread.threadId,
        payload: thread.sharePayload,
        createdAt: thread.shareCreatedAt.toISOString(),
        keyManifest,
      },
      {
        id: thread.threadId,
        type: 'message',
        payload: thread.messagePayload,
        createdAt: thread.messageCreatedAt.toISOString(),
        lastCommentAt:
          thread.messageLastCommentAt != null
            ? thread.messageLastCommentAt.toISOString()
            : null,
        keyManifest: {},
      },
    ];
  }

  return [
    {
      id: thread.threadId,
      type: 'message',
      payload: thread.messagePayload,
      createdAt: thread.messageCreatedAt.toISOString(),
      lastCommentAt:
        thread.messageLastCommentAt != null
          ? thread.messageLastCommentAt.toISOString()
          : null,
      keyManifest,
    },
  ];
}

export async function handleListInbox(
  query: ListInboxQuery,
): Promise<InboxPageResponse> {
  const { recipientKeyId, cursorSortAt, cursorThreadId, limit, sort, order } =
    query;

  const page = await inboxRepository.listDeliveries({
    recipientKeyId,
    limit,
    cursor:
      cursorSortAt != null && cursorThreadId != null
        ? { sortAt: new Date(cursorSortAt), threadId: cursorThreadId }
        : undefined,
    sort,
    order,
  });

  const items = page.threads.flatMap((thread) =>
    mapThreadToInboxItems(thread, recipientKeyId),
  );

  return {
    items,
    total: page.total,
    nextCursor:
      page.nextCursor != null
        ? {
            sortAt: page.nextCursor.sortAt.toISOString(),
            threadId: page.nextCursor.threadId,
          }
        : null,
  };
}
