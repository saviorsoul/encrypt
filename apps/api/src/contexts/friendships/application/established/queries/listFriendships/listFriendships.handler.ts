import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export type ListFriendshipsQuery = {
  ownerKeyId: string;
};

export async function handleListFriendships(query: ListFriendshipsQuery) {
  const { ownerKeyId } = query;
  await assertRecipientsRegistered([ownerKeyId]);
  const rows =
    await friendshipRepository.listFriendshipsWithPublicKeys(ownerKeyId);
  return rows.map(({ friendKeyId, publicKey, createdAt, invitationToken }) => ({
    friendKeyId,
    publicKey,
    invitationToken,
    createdAt: createdAt.toISOString(),
  }));
}
