import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma.js';
import type {
  InboxDeliveryRef,
  InboxOrder,
  InboxRepository,
  ListInboxDeliveriesResult,
} from '@/contexts/feed/domain/ports/InboxRepository.js';

function inboxDeliveriesCte(recipientKeyId: string): Prisma.Sql {
  return Prisma.sql`
    WITH inbox_deliveries AS (
      SELECT mkms.share_id AS id, s.created_at AS created_at, 'share'::text AS kind
      FROM message_key_manifest_shards mkms
      INNER JOIN shares s ON s.id = mkms.share_id
      WHERE mkms.recipient_key_id = ${recipientKeyId}
        AND mkms.share_id IS NOT NULL

      UNION

      SELECT mkms.message_id AS id, m.created_at AS created_at, 'message'::text AS kind
      FROM message_key_manifest_shards mkms
      INNER JOIN messages m ON m.id = mkms.message_id
      WHERE mkms.recipient_key_id = ${recipientKeyId}
        AND mkms.share_id IS NULL

      UNION

      SELECT DISTINCT mkms.message_id AS id, m.created_at AS created_at, 'message'::text AS kind
      FROM message_key_manifest_shards mkms
      INNER JOIN messages m ON m.id = mkms.message_id
      WHERE mkms.recipient_key_id = ${recipientKeyId}
        AND mkms.share_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM message_key_manifest_shards direct
          WHERE direct.recipient_key_id = mkms.recipient_key_id
            AND direct.message_id = mkms.message_id
            AND direct.share_id IS NULL
        )
    )
  `;
}

function buildCursorFilter(
  order: InboxOrder,
  cursorCreatedAt: Date,
  cursorId: string,
): Prisma.Sql {
  if (order === 'desc') {
    return Prisma.sql`
      AND (
        created_at < ${cursorCreatedAt}
        OR (created_at = ${cursorCreatedAt} AND id < ${cursorId}::uuid)
      )
    `;
  }

  return Prisma.sql`
    AND (
      created_at > ${cursorCreatedAt}
      OR (created_at = ${cursorCreatedAt} AND id > ${cursorId}::uuid)
    )
  `;
}

function buildOrderBy(order: InboxOrder): Prisma.Sql {
  return order === 'desc'
    ? Prisma.sql`ORDER BY created_at DESC, id DESC`
    : Prisma.sql`ORDER BY created_at ASC, id ASC`;
}

type InboxDeliveryRow = {
  id: string;
  created_at: Date;
  kind: 'message' | 'share';
};

async function getCursorCreatedAt(
  recipientKeyId: string,
  cursorId: string,
): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ created_at: Date }>>(
    Prisma.sql`
      ${inboxDeliveriesCte(recipientKeyId)}
      SELECT created_at
      FROM inbox_deliveries
      WHERE id = ${cursorId}::uuid
      LIMIT 1
    `,
  );

  return rows[0]?.created_at ?? null;
}

function toDeliveryRef(row: InboxDeliveryRow): InboxDeliveryRef {
  return {
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
  };
}

export const inboxRepository: InboxRepository = {
  async countDeliveries({ recipientKeyId }) {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`
        ${inboxDeliveriesCte(recipientKeyId)}
        SELECT COUNT(*)::int AS count
        FROM inbox_deliveries
      `,
    );

    return rows[0]?.count ?? 0;
  },

  async listDeliveries({
    recipientKeyId,
    limit,
    cursor,
    order,
  }): Promise<ListInboxDeliveriesResult> {
    const cursorCreatedAt =
      cursor !== undefined
        ? await getCursorCreatedAt(recipientKeyId, cursor)
        : null;
    const cursorFilter =
      cursor !== undefined && cursorCreatedAt !== null
        ? buildCursorFilter(order, cursorCreatedAt, cursor)
        : Prisma.empty;

    const rows = await prisma.$queryRaw<InboxDeliveryRow[]>(
      Prisma.sql`
        ${inboxDeliveriesCte(recipientKeyId)}
        SELECT id, created_at, kind
        FROM inbox_deliveries
        WHERE 1 = 1
        ${cursorFilter}
        ${buildOrderBy(order)}
        LIMIT ${limit + 1}
      `,
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const deliveries = pageRows.map(toDeliveryRef);

    return {
      deliveries,
      nextCursor:
        hasMore && deliveries.length > 0
          ? deliveries[deliveries.length - 1]!.id
          : null,
    };
  },

  async recipientHasShareAccessToParent(
    parentMessageId: string,
    recipientKeyId: string,
  ): Promise<boolean> {
    const count = await prisma.messageKeyManifestShard.count({
      where: {
        messageId: parentMessageId,
        recipientKeyId,
        shareId: { not: null },
      },
    });
    return count > 0;
  },
};
