import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleMarkMessageHistoryShared } from '@/contexts/friendships/application/established/commands/markMessageHistoryShared/markMessageHistoryShared.handler.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js',
  () => ({
    friendshipRepository: {
      markMessageHistoryShared: vi.fn(),
    },
  }),
);

describe('handleMarkMessageHistoryShared', () => {
  beforeEach(() => {
    vi.mocked(friendshipRepository.markMessageHistoryShared).mockReset();
  });

  it('returns serialized friendship slice when marking succeeds', async () => {
    const sharedAt = new Date('2026-09-06T12:00:00.000Z');
    vi.mocked(friendshipRepository.markMessageHistoryShared).mockResolvedValue({
      friendKeyId: 'friend-key-id',
      messageHistorySharedAt: sharedAt,
    });

    const result = await handleMarkMessageHistoryShared({
      ownerKeyId: 'owner-key-id',
      friendKeyId: 'friend-key-id',
    });

    expect(result).toEqual({
      friendKeyId: 'friend-key-id',
      messageHistorySharedAt: sharedAt.toISOString(),
    });
    expect(friendshipRepository.markMessageHistoryShared).toHaveBeenCalledWith(
      'owner-key-id',
      'friend-key-id',
    );
  });

  it('throws not found when friendship is missing', async () => {
    vi.mocked(friendshipRepository.markMessageHistoryShared).mockResolvedValue(
      null,
    );

    await expect(
      handleMarkMessageHistoryShared({
        ownerKeyId: 'owner-key-id',
        friendKeyId: 'missing-friend',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
