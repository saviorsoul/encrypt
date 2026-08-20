import { badRequest, conflict } from '@/lib/httpError.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

export function assertDistinctKeyIds(keyIdA: string, keyIdB: string): void {
  if (keyIdA === keyIdB) {
    throw badRequest('Cannot create a friendship with yourself.');
  }
}

export async function assertNotAlreadyFriends(
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  if (await friendshipRepository.areFriends(keyIdA, keyIdB)) {
    throw conflict('Users are already friends.');
  }
}

export async function assertPendingInvitationForRequester(
  requesterKeyId: string,
  invitationToken: string,
): Promise<void> {
  const invitation = await friendInvitationRepository.findPendingForInviter(
    invitationToken,
    requesterKeyId,
  );
  if (!invitation) {
    throw badRequest('Invitation not found or already used.');
  }
}
