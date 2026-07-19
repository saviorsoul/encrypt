import { userRepository } from '@/contexts/users/index.js';
import { gone, notFound } from '@/lib/httpError.js';
import { FRIEND_INVITATION_CONSUMED } from '@/contexts/friendships/domain/constants.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';

export type GetFriendInvitationQuery = {
  token: string;
};

export async function handleGetFriendInvitation(
  query: GetFriendInvitationQuery,
) {
  const { token } = query;
  const row = await friendInvitationRepository.findByToken(token);
  if (!row) {
    throw notFound('Invitation not found.');
  }

  const publicKeys = await userRepository.findPublicKeysByKeyIds([
    row.inviterKeyId,
  ]);
  const inviterPublicKey = publicKeys.get(row.inviterKeyId);
  if (!inviterPublicKey) {
    throw notFound('Invitation not found.');
  }

  if (row.status === FRIEND_INVITATION_CONSUMED) {
    throw gone('Invitation already used.', {
      token: row.token,
      status: FRIEND_INVITATION_CONSUMED,
      inviterKeyId: row.inviterKeyId,
      inviteeKeyId: row.inviteeKeyId,
      consumedAt: row.consumedAt?.toISOString() ?? null,
    });
  }

  return {
    token: row.token,
    status: 'pending',
    inviterKeyId: row.inviterKeyId,
    inviterPublicKey,
    createdAt: row.createdAt.toISOString(),
  };
}
