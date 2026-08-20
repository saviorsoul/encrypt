import { afterEach, describe, expect, it, vi } from 'vitest';
import { eraseRecipientFeedData } from '@/contexts/feed/infrastructure/eraseRecipientFeedData.js';
import { type PrismaTx } from '@/lib/prisma.js';

const txMocks = vi.hoisted(() => ({
  messageKeyManifestShard: { findMany: vi.fn(), deleteMany: vi.fn() },
  comment: { deleteMany: vi.fn() },
  share: { deleteMany: vi.fn() },
  message: { deleteMany: vi.fn() },
}));

const tx = txMocks;

describe('eraseRecipientFeedData', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes recipient shards and orphaned ciphertext only', async () => {
    const sharedMessageId = '11111111-1111-1111-1111-111111111111';
    const orphanMessageId = '22222222-2222-2222-2222-222222222222';

    txMocks.messageKeyManifestShard.findMany
      .mockResolvedValueOnce([
        { messageId: sharedMessageId },
        { messageId: orphanMessageId },
      ])
      .mockResolvedValueOnce([{ messageId: sharedMessageId }]);

    for (const mock of [
      txMocks.messageKeyManifestShard.deleteMany,
      txMocks.comment.deleteMany,
      txMocks.share.deleteMany,
      txMocks.message.deleteMany,
    ]) {
      mock.mockResolvedValue({ count: 1 });
    }

    await eraseRecipientFeedData('subject-key', tx as unknown as PrismaTx);

    expect(txMocks.messageKeyManifestShard.deleteMany).toHaveBeenCalledWith({
      where: { recipientKeyId: 'subject-key' },
    });
    expect(txMocks.message.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [orphanMessageId] } },
    });
    expect(txMocks.comment.deleteMany).toHaveBeenCalledWith({
      where: { messageId: { in: [orphanMessageId] } },
    });
    expect(txMocks.share.deleteMany).toHaveBeenCalledWith({
      where: { messageId: { in: [orphanMessageId] } },
    });
  });
});
