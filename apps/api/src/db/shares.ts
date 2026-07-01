import type { StoredShare } from '@encrypt/core/feed/types';
import { prisma } from '../lib/prisma.js';

export async function getShareById(id: string): Promise<StoredShare | null> {
  const row = await prisma.share.findUnique({ where: { id } });
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    messageId: row.messageId,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
  };
}

export async function insertShare(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  messageId: string,
  payload: string,
): Promise<StoredShare> {
  const row = await tx.share.create({
    data: { id, messageId, payload },
  });

  return {
    id: row.id,
    messageId: row.messageId,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
  };
}
