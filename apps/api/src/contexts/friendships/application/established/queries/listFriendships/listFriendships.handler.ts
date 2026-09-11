import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type ListFriendshipsQuery = {
  ownerKeyId: string;
};

export async function handleListFriendships(query: ListFriendshipsQuery) {
  const { ownerKeyId } = query;
  const rows =
    await friendshipRepository.listFriendshipsWithPublicKeys(ownerKeyId);
  return rows.map(
    ({
      friendKeyId,
      publicKey,
      createdAt,
      invitationToken,
      messageHistorySharedAt,
      messagesMuted,
      sharesMuted,
    }) => ({
      friendKeyId,
      publicKey,
      invitationToken,
      createdAt: createdAt.toISOString(),
      messageHistorySharedAt: messageHistorySharedAt?.toISOString() ?? null,
      messagesMuted,
      sharesMuted,
    }),
  );
}
