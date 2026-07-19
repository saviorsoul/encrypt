import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { registerUserForIncomingFriendshipRequests } from '@/contexts/friendships/application/invitationRegistration.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type ListFriendshipRequestsQuery = {
  keyId: string;
  publicKey: { x: string; y: string };
};

export async function handleListFriendshipRequests(
  query: ListFriendshipRequestsQuery,
) {
  const { keyId, publicKey } = query;
  await registerUserForIncomingFriendshipRequests(keyId, publicKey);
  await assertRecipientsRegistered([keyId]);
  const [incomingRows, outgoingRows] = await Promise.all([
    friendshipRepository.listIncomingPendingRequests(keyId),
    friendshipRepository.listOutgoingPendingRequests(keyId),
  ]);
  return {
    incoming: friendshipRepository.serializeFriendshipRequests(incomingRows),
    outgoing: friendshipRepository.serializeFriendshipRequests(outgoingRows),
  };
}
