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

export const messageRepository: MessageRepository = {
  async getById(id: string): Promise<StoredMessage | null> {
    const row = await prisma.message.findUnique({ where: { id } });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      payload: row.payload,
      createdAt: row.createdAt.getTime(),
    };
  },

  async exists(id: string): Promise<boolean> {
    const count = await prisma.message.count({ where: { id } });
    return count > 0;
  },

  async createWithManifestShards(
    id: string,
    payload: string,
    keyManifest: KeyManifestMap,
  ): Promise<StoredMessage> {
    try {
      return await prisma.$transaction(async (tx) => {
        const message = await insertMessage(tx, id, payload);
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
};
