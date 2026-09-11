import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma.js';
import type {
  InboxCursor,
  InboxOrder,
  InboxPageThread,
  InboxRepository,
  InboxSort,
  ListInboxDeliveriesResult,
} from '@/contexts/feed/domain/ports/InboxRepository.js';

function buildThreadSortAtExpr(sort: InboxSort): Prisma.Sql {
  if (sort === 'originalDate') {
    return Prisma.sql`m.created_at`;
  }

  if (sort === 'lastComment') {
    return Prisma.sql`COALESCE(m.last_comment_at, TIMESTAMPTZ '1970-01-01 00:00:00+00')`;
  }

  return Prisma.sql`
    CASE
      WHEN mkms.share_id IS NULL THEN m.created_at
      ELSE COALESCE(s.created_at, m.created_at)
    END
  `;
}

function buildThreadCursorFilter(
  order: InboxOrder,
  cursor: InboxCursor,
): Prisma.Sql {
  if (order === 'desc') {
    return Prisma.sql`
      AND (
        sort_at < ${cursor.sortAt}
        OR (sort_at = ${cursor.sortAt} AND thread_id < ${cursor.threadId}::uuid)
      )
    `;
  }

  return Prisma.sql`
    AND (
      sort_at > ${cursor.sortAt}
      OR (sort_at = ${cursor.sortAt} AND thread_id > ${cursor.threadId}::uuid)
    )
  `;
}

function buildThreadOrderBy(order: InboxOrder): Prisma.Sql {
  return order === 'desc'
    ? Prisma.sql`ORDER BY sort_at DESC, thread_id DESC`
    : Prisma.sql`ORDER BY sort_at ASC, thread_id ASC`;
}

type InboxPageRow = {
  thread_id: string;
  sort_at: Date;
  total_count: number;
  share_id: string | null;
  entry_json: string;
  message_payload: string;
  message_created_at: Date;
  message_last_comment_at: Date | null;
  share_payload: string | null;
  share_created_at: Date | null;
};

function toPageThread(row: InboxPageRow): InboxPageThread {
  return {
    threadId: row.thread_id,
    sortAt: row.sort_at,
    shareId: row.share_id,
    entryJson: row.entry_json,
    messagePayload: row.message_payload,
    messageCreatedAt: row.message_created_at,
    messageLastCommentAt: row.message_last_comment_at,
    sharePayload: row.share_payload,
    shareCreatedAt: row.share_created_at,
  };
}

export const inboxRepository: InboxRepository = {
  async listDeliveries({
    recipientKeyId,
    limit,
    cursor,
    sort,
    order,
  }): Promise<ListInboxDeliveriesResult> {
    const sortAt = buildThreadSortAtExpr(sort);
    const cursorFilter =
      cursor != null ? buildThreadCursorFilter(order, cursor) : Prisma.empty;

    const pageRows = await prisma.$queryRaw<InboxPageRow[]>(
      Prisma.sql`
        SELECT
          thread_id,
          sort_at,
          total_count,
          share_id,
          entry_json,
          message_payload,
          message_created_at,
          message_last_comment_at,
          share_payload,
          share_created_at
        FROM (
          SELECT
            mkms.message_id AS thread_id,
            ${sortAt} AS sort_at,
            COUNT(*) OVER()::int AS total_count,
            mkms.share_id,
            mkms.entry_json,
            m.payload AS message_payload,
            m.created_at AS message_created_at,
            m.last_comment_at AS message_last_comment_at,
            s.payload AS share_payload,
            s.created_at AS share_created_at
          FROM message_key_manifest_shards mkms
          INNER JOIN messages m ON m.id = mkms.message_id
          LEFT JOIN shares s ON s.id = mkms.share_id
          WHERE mkms.recipient_key_id = ${recipientKeyId}
        ) inbox_threads
        WHERE 1 = 1
        ${cursorFilter}
        ${buildThreadOrderBy(order)}
        LIMIT ${limit + 1}
      `,
    );

    const hasMore = pageRows.length > limit;
    const rows = hasMore ? pageRows.slice(0, limit) : pageRows;
    const total = pageRows[0]?.total_count ?? 0;

    if (rows.length === 0) {
      return {
        threads: [],
        nextCursor: null,
        total,
      };
    }

    const lastRow = rows[rows.length - 1]!;

    return {
      threads: rows.map(toPageThread),
      nextCursor: hasMore
        ? {
            sortAt: lastRow.sort_at,
            threadId: lastRow.thread_id,
          }
        : null,
      total,
    };
  },
};
