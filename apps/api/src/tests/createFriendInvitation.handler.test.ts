import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCreateFriendInvitation } from '@/contexts/friendships/application/invitations/commands/createFriendInvitation/createFriendInvitation.handler.js';

const userRepoMocks = vi.hoisted(() => ({
  exists: vi.fn(),
}));

const invitationRepoMocks = vi.hoisted(() => ({
  createInvitation: vi.fn(),
}));

vi.mock('@/contexts/users/infrastructure/prismaUserRepository.js', () => ({
  userRepository: userRepoMocks,
}));

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js',
  () => ({
    friendInvitationRepository: invitationRepoMocks,
  }),
);

describe('handleCreateFriendInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an invitation when inviter is registered', async () => {
    userRepoMocks.exists.mockResolvedValue(true);
    invitationRepoMocks.createInvitation.mockResolvedValue({
      token: 'token-1',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await handleCreateFriendInvitation({
      inviterKeyId: 'inviter-key',
      inviterPublicKey: { x: '1', y: '2' },
    });

    expect(invitationRepoMocks.createInvitation).toHaveBeenCalledWith(
      'inviter-key',
    );
    expect(result.token).toBe('token-1');
  });

  it('rejects unregistered inviter', async () => {
    userRepoMocks.exists.mockResolvedValue(false);

    await expect(
      handleCreateFriendInvitation({
        inviterKeyId: 'inviter-key',
        inviterPublicKey: { x: '1', y: '2' },
      }),
    ).rejects.toThrow('You must be registered before sending invitations.');

    expect(invitationRepoMocks.createInvitation).not.toHaveBeenCalled();
  });
});
