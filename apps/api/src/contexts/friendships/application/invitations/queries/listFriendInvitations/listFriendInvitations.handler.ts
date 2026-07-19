import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';

export type ListFriendInvitationsQuery = {
  inviterKeyId: string;
};

export async function handleListFriendInvitations(
  query: ListFriendInvitationsQuery,
) {
  const rows = await friendInvitationRepository.listPendingForInviter(
    query.inviterKeyId,
  );
  return rows.map((row) => friendInvitationRepository.serialize(row));
}
