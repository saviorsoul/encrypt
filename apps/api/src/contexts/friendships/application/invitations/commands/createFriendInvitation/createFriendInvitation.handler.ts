import { userRepository } from '@/contexts/users/index.js';
import { badRequest } from '@/lib/httpError.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';

export type CreateFriendInvitationCommand = {
  inviterKeyId: string;
  inviterPublicKey: { x: string; y: string };
};

export async function handleCreateFriendInvitation(
  command: CreateFriendInvitationCommand,
) {
  const { inviterKeyId } = command;

  if (!(await userRepository.exists(inviterKeyId))) {
    throw badRequest('You must be registered before sending invitations.');
  }

  return friendInvitationRepository.createInvitation(inviterKeyId);
}
