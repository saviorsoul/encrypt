import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleCreateComment } from '@/contexts/feed/application/comments/commands/createComment/createComment.handler.js';
import { commentRepository } from '@/contexts/feed/infrastructure/prismaCommentRepository.js';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';
import { prisma } from '@/lib/prisma.js';

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/contexts/feed/infrastructure/prismaCommentRepository.js', () => ({
  commentRepository: {
    insert: vi.fn(),
  },
}));

vi.mock('@/contexts/feed/infrastructure/prismaMessageRepository.js', () => ({
  messageRepository: {
    getById: vi.fn(),
    touchLastCommentAt: vi.fn(),
  },
}));

describe('handleCreateComment', () => {
  beforeEach(() => {
    vi.mocked(messageRepository.getById).mockReset();
    vi.mocked(commentRepository.insert).mockReset();
    vi.mocked(messageRepository.touchLastCommentAt).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
  });

  it('updates lastCommentAt in the same transaction as comment insert', async () => {
    const messageId = '550e8400-e29b-41d4-a716-446655440000';
    const commentCreatedAt = 1_700_000_000_000;

    vi.mocked(messageRepository.getById).mockResolvedValue({
      id: messageId,
      payload: '{}',
      createdAt: 1_600_000_000_000,
      lastCommentAt: null,
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({} as never),
    );
    vi.mocked(commentRepository.insert).mockResolvedValue({
      id: 'comment-id',
      messageId,
      payload: '{}',
      createdAt: commentCreatedAt,
    });

    const result = await handleCreateComment({
      messageId,
      authorKeyId: 'author-key-id',
      encryptedContent: { iv: 'iv', ciphertext: 'cipher' },
      authorSignature: 'sig',
    });

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(commentRepository.insert).toHaveBeenCalledTimes(1);
    expect(messageRepository.touchLastCommentAt).toHaveBeenCalledWith(
      messageId,
      new Date(commentCreatedAt),
      {},
    );
  });

  it('throws not found when parent message is missing', async () => {
    vi.mocked(messageRepository.getById).mockResolvedValue(null);

    await expect(
      handleCreateComment({
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        authorKeyId: 'author-key-id',
        encryptedContent: { iv: 'iv', ciphertext: 'cipher' },
        authorSignature: 'sig',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
