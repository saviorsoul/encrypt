import { notFound } from '@/lib/httpError.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';

export type RemoveFriendInvitationCommand = {
  token: string;
  inviterKeyId: string;
};

export async function handleRemoveFriendInvitation(
  command: RemoveFriendInvitationCommand,
) {
  const removed = await friendInvitationRepository.deletePendingForInviter(
    command.token,
    command.inviterKeyId,
  );
  if (!removed) {
    throw notFound('Pending invitation not found.');
  }

  return { status: 'removed' as const };
}
