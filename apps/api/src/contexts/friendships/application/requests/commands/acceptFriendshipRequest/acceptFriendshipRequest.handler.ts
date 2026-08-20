import { badRequest, notFound } from '@/lib/httpError.js';
import { FRIENDSHIP_REQUEST_PENDING } from '@/contexts/friendships/domain/constants.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/application/services/friendshipAssertions.js';
import { userRepository } from '@/contexts/users/index.js';
import { ensureRegisteredAfterFriendshipPair } from '@/contexts/users/index.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type AcceptFriendshipRequestCommand = {
  requesterKeyId: string;
  targetKeyId: string;
  targetPublicKey: { x: string; y: string };
};

export async function handleAcceptFriendshipRequest(
  command: AcceptFriendshipRequestCommand,
) {
  const { requesterKeyId, targetKeyId, targetPublicKey } = command;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);

  const pending = await friendshipRepository.findFriendshipRequest(
    requesterKeyId,
    targetKeyId,
  );
  if (!pending || pending.status !== FRIENDSHIP_REQUEST_PENDING) {
    throw notFound('Pending friendship request not found.');
  }

  const { invitationToken } = pending;
  if (!invitationToken) {
    throw badRequest(
      'Pending friendship request is missing an invitation. Send a new request.',
    );
  }

  const requesterPublicKeys = await userRepository.findPublicKeysByKeyIds([
    requesterKeyId,
  ]);
  const requesterPublicKey = requesterPublicKeys.get(requesterKeyId);
  if (!requesterPublicKey) {
    throw badRequest('Friendship requester is not registered.');
  }

  if (await friendshipRepository.areFriends(requesterKeyId, targetKeyId)) {
    await friendshipRepository.clearPendingAndConsumeInvitation(
      requesterKeyId,
      targetKeyId,
      invitationToken,
      targetKeyId,
    );
    return { status: 'accepted' as const };
  }

  await friendshipRepository.establishMutualFriendship(
    requesterKeyId,
    targetKeyId,
    invitationToken,
  );

  await ensureRegisteredAfterFriendshipPair(
    requesterKeyId,
    requesterPublicKey,
    targetKeyId,
    targetPublicKey,
  );

  return { status: 'accepted' as const };
}
