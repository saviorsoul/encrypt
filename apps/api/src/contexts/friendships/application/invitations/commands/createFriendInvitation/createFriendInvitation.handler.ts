import { badRequest } from '@/lib/httpError.js';
import { registerInviterForNewInvitation } from '@/contexts/friendships/application/invitationRegistration.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type CreateFriendInvitationCommand = {
  inviterKeyId: string;
  inviterPublicKey: { x: string; y: string };
};

export async function handleCreateFriendInvitation(
  command: CreateFriendInvitationCommand,
) {
  const { inviterKeyId, inviterPublicKey } = command;
  await registerInviterForNewInvitation(inviterKeyId, inviterPublicKey);

  if (!(await friendshipRepository.hasFriends(inviterKeyId))) {
    throw badRequest('Add or accept a friend before sending invitations.');
  }

  return friendInvitationRepository.createInvitation(inviterKeyId);
}
