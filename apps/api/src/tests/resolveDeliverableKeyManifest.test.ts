import { afterEach, describe, expect, it, vi } from 'vitest';
import { FRIENDSHIP_MUTE_SCOPE_MESSAGES } from '@/contexts/friendships/domain/constants.js';
import { resolveDeliverableKeyManifest } from '@/contexts/feed/application/messages/resolveDeliverableKeyManifest.js';

const friendshipMocks = vi.hoisted(() => ({
  listDeliveryFriendshipConstraints: vi.fn(),
}));

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js',
  () => ({
    friendshipRepository: friendshipMocks,
  }),
);

const shard = {
  keyId: 'placeholder',
  iv: 'iv',
  salt: 'salt',
  encryptedDek: 'dek',
};

describe('resolveDeliverableKeyManifest', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('filters friends and recipients who muted the sender for the delivery scope', async () => {
    friendshipMocks.listDeliveryFriendshipConstraints.mockResolvedValue({
      friendKeyIds: new Set(['friend', 'mutedFriend']),
      recipientKeyIdsWhoMutedMessages: new Set(['mutedFriend']),
      recipientKeyIdsWhoMutedShares: new Set(),
    });

    const result = await resolveDeliverableKeyManifest(
      {
        sender: { ...shard, keyId: 'sender' },
        friend: { ...shard, keyId: 'friend' },
        mutedFriend: { ...shard, keyId: 'mutedFriend' },
        stranger: { ...shard, keyId: 'stranger' },
      },
      'sender',
      FRIENDSHIP_MUTE_SCOPE_MESSAGES,
    );

    expect(result).toEqual({
      sender: { ...shard, keyId: 'sender' },
      friend: { ...shard, keyId: 'friend' },
    });
    expect(
      friendshipMocks.listDeliveryFriendshipConstraints,
    ).toHaveBeenCalledWith('sender', ['friend', 'mutedFriend', 'stranger']);
  });
});
