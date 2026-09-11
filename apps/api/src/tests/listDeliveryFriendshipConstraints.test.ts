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

describe('listDeliveryFriendshipConstraints', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads sender friends and both mute kinds in one query', async () => {
    prismaMocks.userFriendship.findMany.mockResolvedValue([
      {
        ownerKeyId: 'sender',
        friendKeyId: 'friend',
        messagesMuted: false,
        sharesMuted: false,
      },
      {
        ownerKeyId: 'messagesMutedFriend',
        friendKeyId: 'sender',
        messagesMuted: true,
        sharesMuted: false,
      },
      {
        ownerKeyId: 'sharesMutedFriend',
        friendKeyId: 'sender',
        messagesMuted: false,
        sharesMuted: true,
      },
    ]);

    const result = await friendshipRepository.listDeliveryFriendshipConstraints(
      'sender',
      ['friend', 'messagesMutedFriend', 'sharesMutedFriend', 'stranger'],
    );

    expect(result).toEqual({
      friendKeyIds: new Set(['friend']),
      recipientKeyIdsWhoMutedMessages: new Set(['messagesMutedFriend']),
      recipientKeyIdsWhoMutedShares: new Set(['sharesMutedFriend']),
    });
    expect(prismaMocks.userFriendship.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { ownerKeyId: 'sender' },
          {
            friendKeyId: 'sender',
            ownerKeyId: {
              in: [
                'friend',
                'messagesMutedFriend',
                'sharesMutedFriend',
                'stranger',
              ],
            },
          },
        ],
      },
      select: {
        ownerKeyId: true,
        friendKeyId: true,
        messagesMuted: true,
        sharesMuted: true,
      },
    });
  });

  it('loads recipients who muted an author messages in one query', async () => {
    prismaMocks.userFriendship.findMany.mockResolvedValue([
      { ownerKeyId: 'recipient-a' },
      { ownerKeyId: 'recipient-c' },
    ]);

    const result =
      await friendshipRepository.listRecipientsWhoMutedAuthorMessages(
        'author',
        ['recipient-a', 'recipient-b', 'recipient-c'],
      );

    expect(result).toEqual(new Set(['recipient-a', 'recipient-c']));
    expect(prismaMocks.userFriendship.findMany).toHaveBeenCalledWith({
      where: {
        friendKeyId: 'author',
        ownerKeyId: { in: ['recipient-a', 'recipient-b', 'recipient-c'] },
        messagesMuted: true,
      },
      select: {
        ownerKeyId: true,
      },
    });
  });

  it('skips the incoming-recipient branch when there are no recipients', async () => {
    prismaMocks.userFriendship.findMany.mockResolvedValue([
      {
        ownerKeyId: 'sender',
        friendKeyId: 'friend',
        messagesMuted: false,
        sharesMuted: false,
      },
    ]);

    const result = await friendshipRepository.listDeliveryFriendshipConstraints(
      'sender',
      [],
    );

    expect(result).toEqual({
      friendKeyIds: new Set(['friend']),
      recipientKeyIdsWhoMutedMessages: new Set(),
      recipientKeyIdsWhoMutedShares: new Set(),
    });
    expect(prismaMocks.userFriendship.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ ownerKeyId: 'sender' }],
      },
      select: {
        ownerKeyId: true,
        friendKeyId: true,
        messagesMuted: true,
        sharesMuted: true,
      },
    });
  });
});
