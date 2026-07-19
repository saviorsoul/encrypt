import { userRepository } from '@/contexts/users/index.js';
import { badRequest, gone, notFound } from '@/lib/httpError.js';
import { FRIEND_INVITATION_CONSUMED } from '@/contexts/friendships/domain/constants.js';
import { registerInviteeForFriendInvitationAccept } from '@/contexts/friendships/application/invitationRegistration.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';
import { friendshipWritePort } from '@/contexts/friendships/infrastructure/prismaFriendshipWriteAdapter.js';

export type AcceptFriendInvitationCommand = {
  token: string;
  inviteeKeyId: string;
  inviteePublicKey: { x: string; y: string };
};

export async function handleAcceptFriendInvitation(
  command: AcceptFriendInvitationCommand,
) {
  const { token, inviteeKeyId, inviteePublicKey } = command;

  const row = await friendInvitationRepository.findByToken(token);
  if (!row) {
    throw notFound('Invitation not found.');
  }

  if (row.status === FRIEND_INVITATION_CONSUMED) {
    throw gone('Invitation already used.');
  }

  if (row.inviterKeyId === inviteeKeyId) {
    throw badRequest('Cannot accept your own invitation.');
  }

  await registerInviteeForFriendInvitationAccept(
    inviteeKeyId,
    inviteePublicKey,
    token,
  );

  if (!(await userRepository.exists(row.inviterKeyId))) {
    throw badRequest(
      'Invitation inviter is not registered. Ask them to create a new invitation link.',
    );
  }

  await friendshipWritePort.acceptFriendInvitationEstablishingFriendship(
    row.inviterKeyId,
    inviteeKeyId,
    token,
  );

  return { status: 'accepted' as const };
}
