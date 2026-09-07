import { notFound } from '@/lib/httpError.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type MarkMessageHistorySharedCommand = {
  ownerKeyId: string;
  friendKeyId: string;
};

export async function handleMarkMessageHistoryShared(
  command: MarkMessageHistorySharedCommand,
) {
  const result = await friendshipRepository.markMessageHistoryShared(
    command.ownerKeyId,
    command.friendKeyId,
  );
  if (!result) {
    throw notFound('Friendship not found.');
  }
  return {
    friendKeyId: result.friendKeyId,
    messageHistorySharedAt: result.messageHistorySharedAt.toISOString(),
  };
}
