import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDeliverableShareKeyManifest } from '@/contexts/feed/application/shares/resolveDeliverableShareKeyManifest.js';

const friendshipMocks = vi.hoisted(() => ({
  listDeliveryFriendshipConstraints: vi.fn(),
  listRecipientsWhoMutedAuthorMessages: vi.fn(),
}));

const authorMocks = vi.hoisted(() => ({
  resolveParentMessageAuthorKeyId: vi.fn(),
}));

vi.mock(
  '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js',
  () => ({
    friendshipRepository: friendshipMocks,
  }),
);

vi.mock(
  '@/contexts/feed/application/shares/resolveParentMessageAuthorKeyId.js',
  () => ({
    resolveParentMessageAuthorKeyId:
      authorMocks.resolveParentMessageAuthorKeyId,
  }),
);

const shard = {
  keyId: 'placeholder',
  iv: 'iv',
  salt: 'salt',
  encryptedDek: 'dek',
};

describe('resolveDeliverableShareKeyManifest', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses messages mute scope when the sharer authored the parent message', async () => {
    authorMocks.resolveParentMessageAuthorKeyId.mockResolvedValue('sharer');
    friendshipMocks.listDeliveryFriendshipConstraints.mockResolvedValue({
      friendKeyIds: new Set(['friend', 'mutedFriend']),
      recipientKeyIdsWhoMutedMessages: new Set(['mutedFriend']),
      recipientKeyIdsWhoMutedShares: new Set(),
    });

    const result = await resolveDeliverableShareKeyManifest(
      {
        sharer: { ...shard, keyId: 'sharer' },
        friend: { ...shard, keyId: 'friend' },
        mutedFriend: { ...shard, keyId: 'mutedFriend' },
      },
      'sharer',
      'msg-1',
      { version: 1 },
    );

    expect(result).toEqual({
      sharer: { ...shard, keyId: 'sharer' },
      friend: { ...shard, keyId: 'friend' },
    });
    expect(
      friendshipMocks.listRecipientsWhoMutedAuthorMessages,
    ).not.toHaveBeenCalled();
  });

  it('excludes recipients who muted the sharer shares or the original author messages', async () => {
    authorMocks.resolveParentMessageAuthorKeyId.mockResolvedValue('author');
    friendshipMocks.listDeliveryFriendshipConstraints.mockResolvedValue({
      friendKeyIds: new Set([
        'friend',
        'sharerMutedFriend',
        'authorMutedFriend',
        'bothMutedFriend',
      ]),
      recipientKeyIdsWhoMutedMessages: new Set(),
      recipientKeyIdsWhoMutedShares: new Set([
        'sharerMutedFriend',
        'bothMutedFriend',
      ]),
    });
    friendshipMocks.listRecipientsWhoMutedAuthorMessages.mockResolvedValue(
      new Set(['authorMutedFriend', 'bothMutedFriend']),
    );

    const result = await resolveDeliverableShareKeyManifest(
      {
        sharer: { ...shard, keyId: 'sharer' },
        friend: { ...shard, keyId: 'friend' },
        sharerMutedFriend: { ...shard, keyId: 'sharerMutedFriend' },
        authorMutedFriend: { ...shard, keyId: 'authorMutedFriend' },
        bothMutedFriend: { ...shard, keyId: 'bothMutedFriend' },
      },
      'sharer',
      'msg-1',
      { version: 1 },
    );

    expect(result).toEqual({
      sharer: { ...shard, keyId: 'sharer' },
      friend: { ...shard, keyId: 'friend' },
    });
    expect(
      friendshipMocks.listRecipientsWhoMutedAuthorMessages,
    ).toHaveBeenCalledWith('author', [
      'friend',
      'sharerMutedFriend',
      'authorMutedFriend',
      'bothMutedFriend',
    ]);
  });
});
