import { afterEach, describe, expect, it, vi } from 'vitest';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

const prismaMocks = vi.hoisted(() => ({
  userFriendship: { deleteMany: vi.fn() },
  friendshipRequest: { deleteMany: vi.fn() },
}));

vi.mock('@/lib/prisma.js', () => ({
  prisma: prismaMocks,
}));

vi.mock('@/contexts/users/index.js', () => ({
  userRepository: {},
}));

describe('deleteFriendshipsForKeyId', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deletes both directed edges for the cleared key', async () => {
    prismaMocks.userFriendship.deleteMany.mockResolvedValue({ count: 1 });

    await friendshipRepository.deleteFriendshipsForKeyId('cleared-key');

    expect(prismaMocks.userFriendship.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ ownerKeyId: 'cleared-key' }, { friendKeyId: 'cleared-key' }],
      },
    });
  });
});
