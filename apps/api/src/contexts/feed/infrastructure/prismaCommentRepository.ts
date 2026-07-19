import type { StoredComment } from '@encrypt/core/feed/types';
import { prisma } from '@/lib/prisma.js';
import type { CommentRepository } from '@/contexts/feed/domain/ports/CommentRepository.js';

export const commentRepository: CommentRepository = {
  async listForMessage(messageId: string): Promise<StoredComment[]> {
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
  },

  async insert(
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
  },
};
