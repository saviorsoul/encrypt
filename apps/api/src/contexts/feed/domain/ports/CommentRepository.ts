import type { StoredComment } from '@encrypt/core/feed/types';
import type { PrismaTx } from '@/lib/prisma.js';

export interface CommentRepository {
  listForMessage(messageId: string): Promise<StoredComment[]>;
  insert(
    id: string,
    messageId: string,
    payload: string,
    tx?: PrismaTx,
  ): Promise<StoredComment>;
}
