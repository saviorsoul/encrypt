import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { notFound } from '@/lib/httpError.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/domain/friendshipRules.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { friendshipWritePort } from '@/contexts/friendships/infrastructure/prismaFriendshipWriteAdapter.js';

export type DeleteFriendshipCommand = {
  ownerKeyId: string;
  friendKeyId: string;
};

export async function handleDeleteFriendship(command: DeleteFriendshipCommand) {
  const { ownerKeyId, friendKeyId } = command;
  assertDistinctKeyIds(ownerKeyId, friendKeyId);
  await assertRecipientsRegistered([ownerKeyId, friendKeyId]);

  if (!(await friendshipRepository.areFriends(ownerKeyId, friendKeyId))) {
    throw notFound('Friendship not found.');
  }

  await friendshipWritePort.deleteFriendship(ownerKeyId, friendKeyId);
}
