import {
  assertRecipientsRegistered,
  userRepository,
} from '@/contexts/users/index.js';
import { registerUserForIncomingFriendshipRequests } from '@/contexts/friendships/application/invitationRegistration.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import type { SerializedFriendshipRequest } from '@/contexts/friendships/domain/ports/FriendshipRepository.js';

export type ListFriendshipRequestsQuery = {
  keyId: string;
  publicKey: { x: string; y: string };
};

function withCounterpartyPublicKeys(
  requests: SerializedFriendshipRequest[],
  publicKeyByKeyId: Map<string, { x: string; y: string }>,
  counterpartyKeyId: (request: SerializedFriendshipRequest) => string,
) {
  return requests.flatMap((request) => {
    const publicKey = publicKeyByKeyId.get(counterpartyKeyId(request));
    if (!publicKey) {
      return [];
    }
    return [{ ...request, publicKey }];
  });
}

export async function handleListFriendshipRequests(
  query: ListFriendshipRequestsQuery,
) {
  const { keyId, publicKey } = query;
  await registerUserForIncomingFriendshipRequests(keyId, publicKey);
  await assertRecipientsRegistered([keyId]);

  const { incoming: incomingRows, outgoing: outgoingRows } =
    await friendshipRepository.listPendingRequestsForUser(keyId);

  const incoming =
    friendshipRepository.serializeFriendshipRequests(incomingRows);
  const outgoing =
    friendshipRepository.serializeFriendshipRequests(outgoingRows);

  const publicKeyByKeyId = await userRepository.findPublicKeysByKeyIds([
    ...incoming.map((request) => request.requesterKeyId),
    ...outgoing.map((request) => request.targetKeyId),
  ]);

  return {
    incoming: withCounterpartyPublicKeys(
      incoming,
      publicKeyByKeyId,
      (request) => request.requesterKeyId,
    ),
    outgoing: withCounterpartyPublicKeys(
      outgoing,
      publicKeyByKeyId,
      (request) => request.targetKeyId,
    ),
  };
}
