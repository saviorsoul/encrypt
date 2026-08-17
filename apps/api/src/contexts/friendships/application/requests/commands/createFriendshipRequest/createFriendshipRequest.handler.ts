import {
  assertUsersRegistered,
  userRepository,
} from '@/contexts/users/index.js';
import { badRequest } from '@/lib/httpError.js';
import { FRIENDSHIP_REQUEST_PENDING } from '@/contexts/friendships/domain/constants.js';
import { assertDistinctKeyIds } from '@/contexts/friendships/domain/friendshipRules.js';
import {
  assertNotAlreadyFriends,
  assertPendingInvitationForRequester,
} from '@/contexts/friendships/application/services/friendshipAssertions.js';
import { ensureRegisteredAfterFriendshipPair } from '@/contexts/users/index.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { friendshipWritePort } from '@/contexts/friendships/infrastructure/prismaFriendshipWriteAdapter.js';

export type CreateFriendshipRequestCommand = {
  requesterKeyId: string;
  requesterPublicKey: { x: string; y: string };
  targetKeyId: string;
  invitationToken: string;
};

export async function handleCreateFriendshipRequest(
  command: CreateFriendshipRequestCommand,
) {
  const { requesterKeyId, requesterPublicKey, targetKeyId, invitationToken } =
    command;

  assertDistinctKeyIds(requesterKeyId, targetKeyId);

  if (!(await friendshipRepository.hasFriends(requesterKeyId))) {
    throw badRequest('Add or accept a friend before sending invitations.');
  }
  await assertUsersRegistered([targetKeyId]);
  await assertPendingInvitationForRequester(requesterKeyId, invitationToken);
  await assertNotAlreadyFriends(requesterKeyId, targetKeyId);

  const existing = await friendshipRepository.findFriendshipRequest(
    requesterKeyId,
    targetKeyId,
  );
  if (existing?.status === FRIENDSHIP_REQUEST_PENDING) {
    const token = existing.invitationToken ?? invitationToken;
    if (!existing.invitationToken) {
      await friendshipRepository.ensureInvitationTokenOnPendingRequest(
        requesterKeyId,
        targetKeyId,
        invitationToken,
      );
    }

    return {
      status: 'pending' as const,
      request: friendshipRepository.serializeFriendshipRequest({
        ...existing,
        invitationToken: token,
      }),
    };
  }

  const reversePending = await friendshipRepository.findFriendshipRequest(
    targetKeyId,
    requesterKeyId,
  );
  if (
    reversePending?.status === FRIENDSHIP_REQUEST_PENDING &&
    reversePending.invitationToken
  ) {
    await friendshipWritePort.establishMutualFriendship(
      reversePending.requesterKeyId,
      requesterKeyId,
      reversePending.invitationToken,
    );

    const targetPublicKeys = await userRepository.findPublicKeysByKeyIds([
      targetKeyId,
    ]);
    const targetPublicKey = targetPublicKeys.get(targetKeyId);
    if (!targetPublicKey) {
      throw badRequest('Target user is not registered.');
    }

    await ensureRegisteredAfterFriendshipPair(
      requesterKeyId,
      requesterPublicKey,
      targetKeyId,
      targetPublicKey,
    );

    return { status: 'accepted' as const };
  }

  const request = await friendshipRepository.upsertPendingRequest(
    requesterKeyId,
    targetKeyId,
    invitationToken,
  );

  return {
    status: 'pending' as const,
    request: friendshipRepository.serializeFriendshipRequest({
      ...request,
      invitationToken: request.invitationToken ?? invitationToken,
    }),
  };
}
