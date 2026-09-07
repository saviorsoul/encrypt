import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma.js';
import type {
  AuthoredMessageRow,
  AuthoredMessagesRepository,
} from '@/contexts/feed/domain/ports/AuthoredMessagesRepository.js';
import type { InboxOrder } from '@/contexts/feed/domain/ports/InboxRepository.js';

function buildAuthoredMessageCursorFilter(
  order: InboxOrder,
  cursor: { createdAt: Date; id: string },
): Prisma.MessageWhereInput {
  if (order === 'desc') {
    return {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        {
          AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
        },
      ],
    };
  }

  return {
    OR: [
      { createdAt: { gt: cursor.createdAt } },
      {
        AND: [{ createdAt: cursor.createdAt }, { id: { gt: cursor.id } }],
      },
    ],
  };
}

function buildAuthoredMessageWhere(
  authorKeyId: string,
  order: InboxOrder,
  before?: Date,
  cursor?: { createdAt: Date; id: string },
): Prisma.MessageWhereInput {
  const where: Prisma.MessageWhereInput = {
    senderKeyId: authorKeyId,
    ...(before ? { createdAt: { lt: before } } : {}),
  };

  if (cursor != null) {
    where.AND = [buildAuthoredMessageCursorFilter(order, cursor)];
  }

  return where;
}

function buildMessageOrderBy(
  order: InboxOrder,
): Prisma.MessageOrderByWithRelationInput[] {
  return order === 'desc'
    ? [{ createdAt: 'desc' }, { id: 'desc' }]
    : [{ createdAt: 'asc' }, { id: 'asc' }];
}

function toAuthoredMessageRow(
  row: {
    id: string;
    payload: string;
    createdAt: Date;
  },
  manifestEntryJson: string,
): AuthoredMessageRow {
  return {
    id: row.id,
    payload: row.payload,
    createdAt: row.createdAt,
    manifestEntryJson,
  };
}

async function getCursor(
  authorKeyId: string,
  cursorId: string,
): Promise<{ createdAt: Date; id: string } | null> {
  return prisma.message.findFirst({
    where: {
      id: cursorId,
      senderKeyId: authorKeyId,
    },
    select: { id: true, createdAt: true },
  });
}

async function loadManifestEntryJsonByMessageId(
  authorKeyId: string,
  messageIds: string[],
): Promise<Map<string, string>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const shards = await prisma.messageKeyManifestShard.findMany({
    where: {
      recipientKeyId: authorKeyId,
      shareId: null,
      messageId: { in: messageIds },
    },
    select: {
      messageId: true,
      entryJson: true,
    },
  });

  return new Map(shards.map((shard) => [shard.messageId, shard.entryJson]));
}

export const authoredMessagesRepository: AuthoredMessagesRepository = {
  async listAuthoredMessages({ authorKeyId, limit, cursor, order, before }) {
    const cursorRow =
      cursor !== undefined ? await getCursor(authorKeyId, cursor) : null;

    const pageWhere =
      cursorRow != null
        ? buildAuthoredMessageWhere(authorKeyId, order, before, cursorRow)
        : buildAuthoredMessageWhere(authorKeyId, order, before);

    const messageRows = await prisma.message.findMany({
      where: pageWhere,
      orderBy: buildMessageOrderBy(order),
      take: limit + 1,
      select: {
        id: true,
        payload: true,
        createdAt: true,
      },
    });

    const manifestEntryJsonByMessageId = await loadManifestEntryJsonByMessageId(
      authorKeyId,
      messageRows.map((row) => row.id),
    );

    const messages: AuthoredMessageRow[] = [];
    let hasMore = false;

    for (const row of messageRows) {
      const manifestEntryJson = manifestEntryJsonByMessageId.get(row.id);
      if (!manifestEntryJson) {
        continue;
      }

      if (messages.length < limit) {
        messages.push(toAuthoredMessageRow(row, manifestEntryJson));
        continue;
      }

      hasMore = true;
      break;
    }

    return {
      messages,
      nextCursor:
        hasMore && messages.length > 0
          ? messages[messages.length - 1]!.id
          : null,
    };
  },
};
