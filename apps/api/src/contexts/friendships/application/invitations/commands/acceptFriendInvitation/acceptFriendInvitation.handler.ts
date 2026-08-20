import { userRepository } from '@/contexts/users/index.js';
import { badRequest, gone, notFound } from '@/lib/httpError.js';
import { FRIEND_INVITATION_CONSUMED } from '@/contexts/friendships/domain/constants.js';
import { ensureRegisteredAfterFriendshipPair } from '@/contexts/users/index.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

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

  if (!(await userRepository.exists(row.inviterKeyId))) {
    throw badRequest('Invitation inviter is not registered.');
  }

  await friendshipRepository.acceptFriendInvitationEstablishingFriendship(
    row.inviterKeyId,
    inviteeKeyId,
    token,
  );

  const inviterPublicKeys = await userRepository.findPublicKeysByKeyIds([
    row.inviterKeyId,
  ]);
  const inviterPublicKey = inviterPublicKeys.get(row.inviterKeyId);
  if (!inviterPublicKey) {
    throw badRequest(
      'Invitation inviter is not an active account. Ask them for a new invitation link.',
    );
  }

  await ensureRegisteredAfterFriendshipPair(
    inviteeKeyId,
    inviteePublicKey,
    row.inviterKeyId,
    inviterPublicKey,
  );

  return { status: 'accepted' as const };
}
