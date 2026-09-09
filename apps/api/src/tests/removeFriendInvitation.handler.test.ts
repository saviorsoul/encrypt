import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRemoveFriendInvitation } from '@/contexts/friendships/application/invitations/commands/removeFriendInvitation/removeFriendInvitation.handler.js';

const invitationRepoMocks = vi.hoisted(() => ({
  deletePendingForInviter: vi.fn(),
}));

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js',
  () => ({
    friendInvitationRepository: invitationRepoMocks,
  }),
);

describe('handleRemoveFriendInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes a pending invitation for the inviter', async () => {
    invitationRepoMocks.deletePendingForInviter.mockResolvedValue(true);

    const result = await handleRemoveFriendInvitation({
      token: 'token-1',
      inviterKeyId: 'inviter-key',
    });

    expect(invitationRepoMocks.deletePendingForInviter).toHaveBeenCalledWith(
      'token-1',
      'inviter-key',
    );
    expect(result).toEqual({ status: 'removed' });
  });

  it('returns not found when invitation is missing or not owned', async () => {
    invitationRepoMocks.deletePendingForInviter.mockResolvedValue(false);

    await expect(
      handleRemoveFriendInvitation({
        token: 'token-1',
        inviterKeyId: 'other-key',
      }),
    ).rejects.toThrow('Pending invitation not found.');
  });
});
