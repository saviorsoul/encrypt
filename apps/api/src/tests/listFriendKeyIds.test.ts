import { afterEach, describe, expect, it, vi } from 'vitest';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

const prismaMocks = vi.hoisted(() => ({
  userFriendship: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma.js', () => ({
  prisma: prismaMocks,
}));

vi.mock('@/contexts/users/index.js', () => ({
  userRepository: {},
}));

describe('listFriendKeyIds', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns friend keyIds for the owner without loading user status', async () => {
    prismaMocks.userFriendship.findMany.mockResolvedValue([
      { friendKeyId: 'friend-a' },
      { friendKeyId: 'friend-b' },
    ]);

    const result = await friendshipRepository.listFriendKeyIds('owner-key');

    expect(result).toEqual(new Set(['friend-a', 'friend-b']));
    expect(prismaMocks.userFriendship.findMany).toHaveBeenCalledWith({
      where: { ownerKeyId: 'owner-key' },
      select: { friendKeyId: true },
    });
  });
});
