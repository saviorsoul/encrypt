import type { StoredShare } from '@encrypt/core/feed/types';
import { prisma, type PrismaTx } from '@/lib/prisma.js';
import { badRequest, notFound } from '@/lib/httpError.js';
import { verifyManifestSignature } from '@/crypto/signatures.js';
import type {
  CreateShareWriteInput,
  ShareRepository,
} from '@/contexts/feed/domain/ports/ShareRepository.js';
import {
  filterRecipientsWithoutMessageAccess,
  insertManifestShards,
} from './prismaManifestShardRepository.js';
import { insertMessage } from './prismaMessageRepository.js';

export async function insertShare(
  tx: PrismaTx,
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

export const shareRepository: ShareRepository = {
  async getById(id: string): Promise<StoredShare | null> {
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
  },

  async createShareWithAccess(input: CreateShareWriteInput): Promise<void> {
    const {
      shareId,
      threadRootId,
      shareCoreJson,
      keyManifest,
      parentMessage,
      messageId,
    } = input;

    await prisma.$transaction(async (tx) => {
      if (!(await tx.message.findUnique({ where: { id: threadRootId } }))) {
        if (!parentMessage) {
          throw notFound(`Parent message not found: ${threadRootId}`);
        }

        await verifyManifestSignature(
          parentMessage as Parameters<typeof verifyManifestSignature>[0],
        );

        const parentId = messageId ?? threadRootId;
        if (parentId !== threadRootId) {
          throw badRequest(
            'messageId must match share.parentMessageId when providing parentMessage.',
          );
        }

        await insertMessage(tx, parentId, JSON.stringify(parentMessage));
      }

      const newRecipientKeyIds = await filterRecipientsWithoutMessageAccess(
        threadRootId,
        Object.keys(keyManifest),
        tx,
      );
      if (newRecipientKeyIds.length === 0) {
        throw badRequest(
          'All selected recipients already have access to this message.',
        );
      }

      const filteredKeyManifest = Object.fromEntries(
        newRecipientKeyIds.map((keyId) => [keyId, keyManifest[keyId]]),
      );

      await insertShare(tx, shareId, threadRootId, shareCoreJson);
      await insertManifestShards(tx, threadRootId, filteredKeyManifest, {
        shareId,
      });
    });
  },
};
