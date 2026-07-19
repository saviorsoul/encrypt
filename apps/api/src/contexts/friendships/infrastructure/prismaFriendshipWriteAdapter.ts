import { prisma, type PrismaTx } from '@/lib/prisma.js';
import { FRIEND_INVITATION_CONSUMED } from '@/contexts/friendships/domain/constants.js';
import type { FriendshipWritePort } from '@/contexts/friendships/domain/ports/FriendshipWritePort.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

async function insertFriendshipPair(
  tx: PrismaTx,
  keyIdA: string,
  keyIdB: string,
  invitationToken: string,
): Promise<void> {
  await tx.userFriendship.createMany({
    data: [
      { ownerKeyId: keyIdA, friendKeyId: keyIdB, invitationToken },
      { ownerKeyId: keyIdB, friendKeyId: keyIdA, invitationToken },
    ],
    skipDuplicates: true,
  });
}

async function deleteFriendshipPair(
  tx: PrismaTx,
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  await tx.userFriendship.deleteMany({
    where: {
      OR: [
        { ownerKeyId: keyIdA, friendKeyId: keyIdB },
        { ownerKeyId: keyIdB, friendKeyId: keyIdA },
      ],
    },
  });
}

async function deletePendingRequestsBetween(
  tx: PrismaTx,
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  await tx.friendshipRequest.deleteMany({
    where: {
      OR: [
        { requesterKeyId: keyIdA, targetKeyId: keyIdB },
        { requesterKeyId: keyIdB, targetKeyId: keyIdA },
      ],
    },
  });
}

async function consumeFriendInvitation(
  tx: PrismaTx,
  token: string,
  inviteeKeyId: string,
): Promise<void> {
  await tx.friendInvitation.update({
    where: { token },
    data: {
      status: FRIEND_INVITATION_CONSUMED,
      inviteeKeyId,
      consumedAt: new Date(),
    },
  });
}

export const friendshipWritePort: FriendshipWritePort = {
  async establishMutualFriendship(
    inviterKeyId: string,
    inviteeKeyId: string,
    invitationToken: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await deletePendingRequestsBetween(tx, inviterKeyId, inviteeKeyId);
      await insertFriendshipPair(
        tx,
        inviterKeyId,
        inviteeKeyId,
        invitationToken,
      );
      await consumeFriendInvitation(tx, invitationToken, inviteeKeyId);
    });
  },

  async clearPendingAndConsumeInvitation(
    keyIdA: string,
    keyIdB: string,
    invitationToken: string,
    inviteeKeyId: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await deletePendingRequestsBetween(tx, keyIdA, keyIdB);
      await consumeFriendInvitation(tx, invitationToken, inviteeKeyId);
    });
  },

  async deleteFriendship(
    ownerKeyId: string,
    friendKeyId: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await deleteFriendshipPair(tx, ownerKeyId, friendKeyId);
    });
  },

  async acceptFriendInvitationEstablishingFriendship(
    inviterKeyId: string,
    inviteeKeyId: string,
    token: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Matches prior behavior: friendship check uses the default client (not tx).
      if (
        !(await friendshipRepository.areFriends(inviterKeyId, inviteeKeyId))
      ) {
        await deletePendingRequestsBetween(tx, inviterKeyId, inviteeKeyId);
        await insertFriendshipPair(tx, inviterKeyId, inviteeKeyId, token);
      }

      await consumeFriendInvitation(tx, token, inviteeKeyId);
    });
  },
};
