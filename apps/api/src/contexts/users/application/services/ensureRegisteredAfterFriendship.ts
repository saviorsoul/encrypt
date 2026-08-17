import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

type EcPublicKeyJson = { x: string; y: string };

/** Register keyId in users when it has at least one friendship and is not yet registered. */
export async function ensureRegisteredAfterFriendship(
  keyId: string,
  publicKey: EcPublicKeyJson,
): Promise<void> {
  if (!(await friendshipRepository.hasFriends(keyId))) {
    return;
  }
  await userRepository.registerIfAbsent({ keyId, publicKey });
}

export async function ensureRegisteredAfterFriendshipPair(
  keyIdA: string,
  publicKeyA: EcPublicKeyJson,
  keyIdB: string,
  publicKeyB: EcPublicKeyJson,
): Promise<void> {
  await ensureRegisteredAfterFriendship(keyIdA, publicKeyA);
  await ensureRegisteredAfterFriendship(keyIdB, publicKeyB);
}
