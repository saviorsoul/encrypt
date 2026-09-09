import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCreateFriendshipRequest } from '@/contexts/friendships/application/requests/commands/createFriendshipRequest/createFriendshipRequest.handler.js';

const configMocks = vi.hoisted(() => ({
  feedInvitationalOnly: true,
}));

const friendshipRepoMocks = vi.hoisted(() => ({
  hasFriends: vi.fn(),
  findFriendshipRequest: vi.fn(),
  upsertPendingRequest: vi.fn(),
  serializeFriendshipRequest: vi.fn(),
}));

vi.mock('@/config.js', () => ({
  readConfig: () => ({
    feedInvitationalOnly: configMocks.feedInvitationalOnly,
  }),
}));

vi.mock('@/contexts/users/index.js', () => ({
  assertUsersRegistered: vi.fn(),
  userRepository: {
    findPublicKeysByKeyIds: vi.fn(),
  },
}));

vi.mock(
  '@/contexts/friendships/application/services/friendshipAssertions.js',
  () => ({
    assertDistinctKeyIds: vi.fn(),
    assertNotAlreadyFriends: vi.fn(),
    assertPendingInvitationForRequester: vi.fn(),
  }),
);

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js',
  () => ({
    friendshipRepository: friendshipRepoMocks,
  }),
);

describe('handleCreateFriendshipRequest', () => {
  const command = {
    requesterKeyId: 'requester-key',
    requesterPublicKey: { x: '1', y: '2' },
    targetKeyId: 'target-key',
    invitationToken: 'token-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configMocks.feedInvitationalOnly = true;
    friendshipRepoMocks.hasFriends.mockResolvedValue(false);
    friendshipRepoMocks.findFriendshipRequest.mockResolvedValue(null);
    friendshipRepoMocks.upsertPendingRequest.mockResolvedValue({
      requesterKeyId: command.requesterKeyId,
      targetKeyId: command.targetKeyId,
      status: 'pending',
      invitationToken: command.invitationToken,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    friendshipRepoMocks.serializeFriendshipRequest.mockImplementation(
      (row) => row,
    );
  });

  it('requires friends for the requester in invitational-only mode', async () => {
    await expect(handleCreateFriendshipRequest(command)).rejects.toThrow(
      'Add or accept a friend before sending invitations.',
    );

    expect(friendshipRepoMocks.hasFriends).toHaveBeenCalledWith(
      'requester-key',
    );
    expect(friendshipRepoMocks.upsertPendingRequest).not.toHaveBeenCalled();
  });

  it('allows requester with no friends in open mode', async () => {
    configMocks.feedInvitationalOnly = false;

    const result = await handleCreateFriendshipRequest(command);

    expect(friendshipRepoMocks.hasFriends).not.toHaveBeenCalled();
    expect(result.status).toBe('pending');
    expect(friendshipRepoMocks.upsertPendingRequest).toHaveBeenCalled();
  });
});
