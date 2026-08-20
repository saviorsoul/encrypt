import type { PrismaTx } from '@/lib/prisma.js';

/**
 * Feed operations that span shards, messages, shares, and comments.
 */
export interface FeedRepository {
  eraseRecipientFeedData(recipientKeyId: string, tx?: PrismaTx): Promise<void>;
}
