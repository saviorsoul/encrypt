import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { badRequest, notFound } from '@/lib/httpError.js';
import { FRIENDSHIP_REQUEST_PENDING } from '@/contexts/friendships/domain/constants.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/domain/friendshipRules.js';
import { registerUserForIncomingFriendshipRequests } from '@/contexts/friendships/application/invitationRegistration.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type RejectFriendshipRequestCommand = {
  requesterKeyId: string;
  targetKeyId: string;
  targetPublicKey: { x: string; y: string };
};

export async function handleRejectFriendshipRequest(
  command: RejectFriendshipRequestCommand,
) {
  const { requesterKeyId, targetKeyId, targetPublicKey } = command;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);
  await registerUserForIncomingFriendshipRequests(targetKeyId, targetPublicKey);
  await assertRecipientsRegistered([requesterKeyId, targetKeyId]);

  const pending = await friendshipRepository.findFriendshipRequest(
    requesterKeyId,
    targetKeyId,
  );
  if (!pending || pending.status !== FRIENDSHIP_REQUEST_PENDING) {
    throw notFound('Pending friendship request not found.');
  }

  const request = await friendshipRepository.markRejected(
    requesterKeyId,
    targetKeyId,
  );

  if (!request.invitationToken) {
    throw badRequest('Friendship request is missing an invitation token.');
  }

  return friendshipRepository.serializeFriendshipRequest({
    ...request,
    invitationToken: request.invitationToken,
  });
}
