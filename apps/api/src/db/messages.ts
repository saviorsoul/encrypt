import { prisma } from '../lib/prisma.js';
import type { StoredMessage } from '@encrypt/core/feed/types';

export async function getMessageById(
  id: string,
): Promise<StoredMessage | null> {
  const row = await prisma.message.findUnique({ where: { id } });
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
  };
}

export async function messageExists(id: string): Promise<boolean> {
  const count = await prisma.message.count({ where: { id } });
  return count > 0;
}

export async function insertMessage(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  payload: string,
): Promise<StoredMessage> {
  const row = await tx.message.create({
    data: { id, payload },
  });

  return {
    id: row.id,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
  };
}
