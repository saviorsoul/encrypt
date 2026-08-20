import { afterEach, describe, expect, it, vi } from 'vitest';
import { eraseAccountData } from '@/contexts/users/application/services/eraseAccountData.js';

const friendshipRepoMocks = vi.hoisted(() => ({
  deleteFriendshipRequestsForKeyId: vi.fn(),
  deleteFriendshipsForKeyId: vi.fn(),
}));

const feedRepoMocks = vi.hoisted(() => ({
  eraseRecipientFeedData: vi.fn(),
}));

const userRepoMocks = vi.hoisted(() => ({
  markInactive: vi.fn(),
}));

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js',
  () => ({
    friendshipRepository: friendshipRepoMocks,
  }),
);

vi.mock('@/contexts/feed/infrastructure/prismaFeedRepository.js', () => ({
  feedRepository: feedRepoMocks,
}));

vi.mock('@/contexts/users/infrastructure/prismaUserRepository.js', () => ({
  userRepository: userRepoMocks,
}));

describe('eraseAccountData', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes requests and both friendship edges before marking inactive', async () => {
    await eraseAccountData('subject-key');

    expect(
      friendshipRepoMocks.deleteFriendshipRequestsForKeyId,
    ).toHaveBeenCalledWith('subject-key');
    expect(friendshipRepoMocks.deleteFriendshipsForKeyId).toHaveBeenCalledWith(
      'subject-key',
    );
    expect(feedRepoMocks.eraseRecipientFeedData).toHaveBeenCalledWith(
      'subject-key',
    );
    expect(userRepoMocks.markInactive).toHaveBeenCalledWith('subject-key');

    const requestOrder =
      friendshipRepoMocks.deleteFriendshipRequestsForKeyId.mock
        .invocationCallOrder[0];
    const friendshipOrder =
      friendshipRepoMocks.deleteFriendshipsForKeyId.mock.invocationCallOrder[0];
    const inactiveOrder =
      userRepoMocks.markInactive.mock.invocationCallOrder[0];
    expect(requestOrder).toBeLessThan(friendshipOrder);
    expect(friendshipOrder).toBeLessThan(inactiveOrder);
  });
});
