import type { StoredComment } from '@encrypt/core/feed/types';
import { prisma } from '../lib/prisma.js';

export async function listCommentsForMessage(
  messageId: string,
): Promise<StoredComment[]> {
  const rows = await prisma.comment.findMany({
    where: { messageId },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    messageId: row.messageId,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
  }));
}

export async function insertComment(
  id: string,
  messageId: string,
  payload: string,
): Promise<StoredComment> {
  const row = await prisma.comment.create({
    data: { id, messageId, payload },
  });

  return {
    id: row.id,
    messageId: row.messageId,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
  };
}
