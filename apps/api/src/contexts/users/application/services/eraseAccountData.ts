import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { feedRepository } from '@/contexts/feed/infrastructure/prismaFeedRepository.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

/**
 * Erase server-held records for one cryptographic identity.
 *
 * Marks the user inactive (the keyId cannot be registered again),
 * deletes friendship requests, established friendships (both directed
 * edges), this recipient's key-manifest shards, and ciphertext that
 * nobody else can still decrypt. Leaves messages that other recipients
 * still hold.
 *
 * Friend invitations are kept: they record who was invited into the
 * invite-only network (token, inviter keyId, invitee keyId, timestamps).
 * They remain until the operator wipes the beta dataset.
 *
 * Not wrapped in a single transaction: Citus cannot mix multi-shard
 * `user_friendships` deletes with reference-table writes (`users`,
 * `friendship_requests`, messages). Each step is idempotent so the
 * caller can retry. Mark inactive last so a failed graph wipe can be
 * retried while the key is still active.
 */
export async function eraseAccountData(keyId: string): Promise<void> {
  await friendshipRepository.deleteFriendshipRequestsForKeyId(keyId);
  await friendshipRepository.deleteFriendshipsForKeyId(keyId);
  await feedRepository.eraseRecipientFeedData(keyId);
  await userRepository.markInactive(keyId);
}
