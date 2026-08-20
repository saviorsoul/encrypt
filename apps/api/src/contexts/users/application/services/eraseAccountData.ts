import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { feedRepository } from '@/contexts/feed/infrastructure/prismaFeedRepository.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';
import { prisma } from '@/lib/prisma.js';

/**
 * Erase server-held records for one cryptographic identity.
 *
 * Marks the user inactive (the keyId cannot be registered again),
 * deletes friendship requests, established friendships, this recipient's
 * key-manifest shards, and ciphertext that nobody else can still decrypt.
 * Leaves messages that other recipients still hold.
 *
 * Friend invitations are kept: they record who was invited into the
 * invite-only network (token, inviter keyId, invitee keyId, timestamps).
 * They remain until the operator wipes the beta dataset.
 */
export async function eraseAccountData(keyId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await friendshipRepository.deleteFriendshipRequestsForKeyId(keyId, tx);
    await friendshipRepository.deleteFriendshipsForKeyId(keyId, tx);
    await feedRepository.eraseRecipientFeedData(keyId, tx);
    await userRepository.markInactive(keyId, tx);
  });
}
