import { afterEach, describe, expect, it, vi } from 'vitest';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

const txMocks = vi.hoisted(() => ({
  userFriendship: { createMany: vi.fn() },
  friendshipRequest: { deleteMany: vi.fn() },
  friendInvitation: { update: vi.fn() },
}));

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma.js', () => ({
  prisma: prismaMocks,
}));

vi.mock('@/contexts/users/index.js', () => ({
  userRepository: {},
}));

describe('establishMutualFriendship', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates both friendship directions and consumes the invitation', async () => {
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback(txMocks),
    );
    txMocks.friendshipRequest.deleteMany.mockResolvedValue({ count: 0 });
    txMocks.userFriendship.createMany.mockResolvedValue({ count: 2 });
    txMocks.friendInvitation.update.mockResolvedValue({ token: 'token' });

    await friendshipRepository.establishMutualFriendship(
      'inviter-key',
      'invitee-key',
      '550e8400-e29b-41d4-a716-446655440000',
      'invitee-key',
    );

    expect(txMocks.userFriendship.createMany).toHaveBeenCalledWith({
      data: [
        {
          ownerKeyId: 'inviter-key',
          friendKeyId: 'invitee-key',
          invitationToken: '550e8400-e29b-41d4-a716-446655440000',
        },
        {
          ownerKeyId: 'invitee-key',
          friendKeyId: 'inviter-key',
          invitationToken: '550e8400-e29b-41d4-a716-446655440000',
        },
      ],
      skipDuplicates: true,
    });
    expect(txMocks.friendInvitation.update).toHaveBeenCalledWith({
      where: { token: '550e8400-e29b-41d4-a716-446655440000' },
      data: expect.objectContaining({ inviteeKeyId: 'invitee-key' }),
    });
  });
});
