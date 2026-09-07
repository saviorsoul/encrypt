import type { InboxApiItem, InboxPageResponse } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { authoredMessagesRepository } from '@/contexts/feed/infrastructure/prismaAuthoredMessagesRepository.js';
import type { ListAuthoredMessagesQuery } from './listAuthoredMessages.query.js';

function parseBeforeFilter(before?: string): Date | undefined {
  if (!before) {
    return undefined;
  }

  const parsed = new Date(before);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export async function handleListAuthoredMessages(
  query: ListAuthoredMessagesQuery,
): Promise<InboxPageResponse> {
  const { authorKeyId, limit, order } = query;
  const before = parseBeforeFilter(query.before);

  const page = await authoredMessagesRepository.listAuthoredMessages({
    authorKeyId,
    limit,
    cursor: query.cursor,
    order,
    before,
  });

  const items: InboxApiItem[] = page.messages.map((row) => ({
    id: row.id,
    type: 'message',
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
    keyManifest: {
      [authorKeyId]: JSON.parse(
        row.manifestEntryJson,
      ) as KeyManifestMap[string],
    },
  }));

  return {
    items,
    nextCursor: page.nextCursor,
  };
}
