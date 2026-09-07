import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAcceptFriendInvitation } from '@/contexts/friendships/application/invitations/commands/acceptFriendInvitation/acceptFriendInvitation.handler.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { userRepository } from '@/contexts/users/index.js';
import { FRIEND_INVITATION_CONSUMED } from '@/contexts/friendships/domain/constants.js';

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js',
  () => ({
    friendInvitationRepository: {
      findByToken: vi.fn(),
    },
  }),
);

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js',
  () => ({
    friendshipRepository: {
      areMutualFriends: vi.fn(),
      establishMutualFriendship: vi.fn(),
    },
  }),
);

vi.mock('@/contexts/users/index.js', () => ({
  userRepository: {
    exists: vi.fn(),
    findPublicKeysByKeyIds: vi.fn(),
  },
  ensureRegisteredAfterFriendshipPair: vi.fn(),
}));

describe('handleAcceptFriendInvitation', () => {
  beforeEach(() => {
    vi.mocked(friendInvitationRepository.findByToken).mockReset();
    vi.mocked(friendshipRepository.areMutualFriends).mockReset();
    vi.mocked(friendshipRepository.establishMutualFriendship).mockReset();
    vi.mocked(userRepository.exists).mockReset();
    vi.mocked(userRepository.findPublicKeysByKeyIds).mockReset();
  });

  it('returns alreadyFriends when users were already mutual friends', async () => {
    vi.mocked(friendInvitationRepository.findByToken).mockResolvedValue({
      token: '550e8400-e29b-41d4-a716-446655440000',
      inviterKeyId: 'inviter-key',
      status: 'pending',
      inviteeKeyId: null,
      createdAt: new Date(),
      consumedAt: null,
    });
    vi.mocked(userRepository.exists).mockResolvedValue(true);
    vi.mocked(friendshipRepository.areMutualFriends).mockResolvedValue(true);
    vi.mocked(userRepository.findPublicKeysByKeyIds).mockResolvedValue(
      new Map([['inviter-key', { x: 'x', y: 'y' }]]),
    );

    const result = await handleAcceptFriendInvitation({
      token: '550e8400-e29b-41d4-a716-446655440000',
      inviteeKeyId: 'invitee-key',
      inviteePublicKey: { x: 'ix', y: 'iy' },
    });

    expect(result).toEqual({ status: 'alreadyFriends' });
    expect(friendshipRepository.establishMutualFriendship).toHaveBeenCalledWith(
      'inviter-key',
      'invitee-key',
      '550e8400-e29b-41d4-a716-446655440000',
      'invitee-key',
    );
  });

  it('returns accepted when friendship is newly established', async () => {
    vi.mocked(friendInvitationRepository.findByToken).mockResolvedValue({
      token: '550e8400-e29b-41d4-a716-446655440000',
      inviterKeyId: 'inviter-key',
      status: 'pending',
      inviteeKeyId: null,
      createdAt: new Date(),
      consumedAt: null,
    });
    vi.mocked(userRepository.exists).mockResolvedValue(true);
    vi.mocked(friendshipRepository.areMutualFriends).mockResolvedValue(false);
    vi.mocked(userRepository.findPublicKeysByKeyIds).mockResolvedValue(
      new Map([['inviter-key', { x: 'x', y: 'y' }]]),
    );

    const result = await handleAcceptFriendInvitation({
      token: '550e8400-e29b-41d4-a716-446655440000',
      inviteeKeyId: 'invitee-key',
      inviteePublicKey: { x: 'ix', y: 'iy' },
    });

    expect(result).toEqual({ status: 'accepted' });
  });

  it('rejects consumed invitations', async () => {
    vi.mocked(friendInvitationRepository.findByToken).mockResolvedValue({
      token: '550e8400-e29b-41d4-a716-446655440000',
      inviterKeyId: 'inviter-key',
      status: FRIEND_INVITATION_CONSUMED,
      inviteeKeyId: 'invitee-key',
      createdAt: new Date(),
      consumedAt: new Date(),
    });

    await expect(
      handleAcceptFriendInvitation({
        token: '550e8400-e29b-41d4-a716-446655440000',
        inviteeKeyId: 'invitee-key',
        inviteePublicKey: { x: 'ix', y: 'iy' },
      }),
    ).rejects.toMatchObject({
      status: 410,
      message: 'Invitation already used.',
    });
  });
});
