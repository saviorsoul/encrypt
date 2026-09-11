import { notFound } from '@/lib/httpError.js';
import type { FriendshipMuteScope } from '@/contexts/friendships/domain/constants.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/application/services/friendshipAssertions.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type MuteFriendCommand = {
  ownerKeyId: string;
  friendKeyId: string;
  scope: FriendshipMuteScope;
};

export async function handleMuteFriend(command: MuteFriendCommand) {
  const { ownerKeyId, friendKeyId, scope } = command;
  assertDistinctKeyIds(ownerKeyId, friendKeyId);

  const result = await friendshipRepository.muteFriendDelivery(
    ownerKeyId,
    friendKeyId,
    scope,
  );
  if (!result) {
    throw notFound('Friendship not found.');
  }

  return { friendKeyId: result.friendKeyId, scope };
}
