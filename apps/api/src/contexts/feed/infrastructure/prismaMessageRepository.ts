import type { StoredMessage } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { prisma, type PrismaTx } from '@/lib/prisma.js';
import { conflict } from '@/lib/httpError.js';
import type { MessageRepository } from '@/contexts/feed/domain/ports/MessageRepository.js';
import { insertManifestShards } from './prismaManifestShardRepository.js';

export async function insertMessage(
  tx: PrismaTx,
  id: string,
  payload: string,
  senderKeyId: string,
): Promise<StoredMessage> {
  const row = await tx.message.create({
    data: { id, payload, senderKeyId },
  });

  return mapMessageRow(row);
}

function mapMessageRow(row: {
  id: string;
  payload: string;
  createdAt: Date;
  lastCommentAt: Date | null;
}): StoredMessage {
  return {
    id: row.id,
    payload: row.payload,
    createdAt: row.createdAt.getTime(),
    lastCommentAt: row.lastCommentAt?.getTime() ?? null,
  };
}

export async function deleteMessagesByIds(
  messageIds: string[],
  tx?: PrismaTx,
): Promise<void> {
  if (messageIds.length === 0) {
    return;
  }

  const client = tx ?? prisma;
  await client.message.deleteMany({
    where: { id: { in: messageIds } },
  });
}

export const messageRepository: MessageRepository = {
  async getById(id: string): Promise<StoredMessage | null> {
    const row = await prisma.message.findUnique({ where: { id } });
    if (!row) {
      return null;
    }

    return mapMessageRow(row);
  },

  async exists(id: string): Promise<boolean> {
    const count = await prisma.message.count({ where: { id } });
    return count > 0;
  },

  async createWithManifestShards(
    id: string,
    payload: string,
    keyManifest: KeyManifestMap,
    senderKeyId: string,
  ): Promise<StoredMessage> {
    try {
      return await prisma.$transaction(async (tx) => {
        const message = await insertMessage(tx, id, payload, senderKeyId);
        await insertManifestShards(tx, id, keyManifest);
        return message;
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw conflict(`Message already exists: ${id}`);
      }
      throw error;
    }
  },

  async touchLastCommentAt(
    messageId: string,
    at: Date,
    tx?: PrismaTx,
  ): Promise<void> {
    const client = tx ?? prisma;
    await client.message.update({
      where: { id: messageId },
      data: { lastCommentAt: at },
    });
  },
};
