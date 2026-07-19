import type { StoredComment } from '@encrypt/core/feed/types';

export interface CommentRepository {
  listForMessage(messageId: string): Promise<StoredComment[]>;
  insert(
    id: string,
    messageId: string,
    payload: string,
  ): Promise<StoredComment>;
}
