import type { FriendshipMuteScope } from '@/contexts/friendships/domain/constants.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/application/services/friendshipAssertions.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type UnmuteFriendCommand = {
  ownerKeyId: string;
  friendKeyId: string;
  scope: FriendshipMuteScope;
};

export async function handleUnmuteFriend(command: UnmuteFriendCommand) {
  const { ownerKeyId, friendKeyId, scope } = command;
  assertDistinctKeyIds(ownerKeyId, friendKeyId);

  await friendshipRepository.unmuteFriendDelivery(
    ownerKeyId,
    friendKeyId,
    scope,
  );
}
