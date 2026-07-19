import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { badRequest, notFound } from '@/lib/httpError.js';
import { FRIENDSHIP_REQUEST_PENDING } from '@/contexts/friendships/domain/constants.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/domain/friendshipRules.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { friendshipWritePort } from '@/contexts/friendships/infrastructure/prismaFriendshipWriteAdapter.js';
import { registerTargetForFriendshipRequestAccept } from '@/contexts/friendships/application/invitationRegistration.js';

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

  await registerTargetForFriendshipRequestAccept(
    targetKeyId,
    targetPublicKey,
    invitationToken,
  );
  await assertRecipientsRegistered([requesterKeyId, targetKeyId]);

  if (await friendshipRepository.areFriends(requesterKeyId, targetKeyId)) {
    await friendshipWritePort.clearPendingAndConsumeInvitation(
      requesterKeyId,
      targetKeyId,
      invitationToken,
      targetKeyId,
    );
    return { status: 'accepted' as const };
  }

  await friendshipWritePort.establishMutualFriendship(
    requesterKeyId,
    targetKeyId,
    invitationToken,
  );
  return { status: 'accepted' as const };
}
