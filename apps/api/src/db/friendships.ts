import type { Prisma } from '@prisma/client';
import { prisma, type PrismaTx } from '../lib/prisma.js';

export const FRIENDSHIP_REQUEST_PENDING = 'pending';
export const FRIENDSHIP_REQUEST_REJECTED = 'rejected';

type DbClient = PrismaTx | typeof prisma;

export async function areFriends(
  keyIdA: string,
  keyIdB: string,
  client: DbClient = prisma,
): Promise<boolean> {
  const row = await client.userFriendship.findUnique({
    where: {
      ownerKeyId_friendKeyId: { ownerKeyId: keyIdA, friendKeyId: keyIdB },
    },
    select: { ownerKeyId: true },
  });
  return row != null;
}

export async function listFriendshipsForOwner(ownerKeyId: string) {
  return prisma.userFriendship.findMany({
    where: { ownerKeyId },
    select: { friendKeyId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listFriendshipsWithPublicKeys(ownerKeyId: string) {
  const friendships = await listFriendshipsForOwner(ownerKeyId);
  if (friendships.length === 0) {
    return [];
  }

  const friendKeyIds = friendships.map((row) => row.friendKeyId);
  const users = await prisma.user.findMany({
    where: { keyId: { in: friendKeyIds } },
    select: { keyId: true, publicKey: true },
  });
  const publicKeyByKeyId = new Map(
    users.map((user) => [user.keyId, user.publicKey]),
  );

  return friendships
    .map((friendship) => {
      const publicKey = publicKeyByKeyId.get(friendship.friendKeyId);
      if (!publicKey || typeof publicKey !== 'object' || publicKey === null) {
        return null;
      }
      const wire = publicKey as { x?: unknown; y?: unknown };
      if (typeof wire.x !== 'string' || typeof wire.y !== 'string') {
        return null;
      }
      return {
        friendKeyId: friendship.friendKeyId,
        publicKey: { x: wire.x, y: wire.y },
        createdAt: friendship.createdAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function findFriendshipRequest(
  requesterKeyId: string,
  targetKeyId: string,
  client: DbClient = prisma,
) {
  return client.friendshipRequest.findUnique({
    where: {
      requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
    },
  });
}

export async function listIncomingPendingRequests(targetKeyId: string) {
  return prisma.friendshipRequest.findMany({
    where: { targetKeyId, status: FRIENDSHIP_REQUEST_PENDING },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listOutgoingPendingRequests(requesterKeyId: string) {
  return prisma.friendshipRequest.findMany({
    where: { requesterKeyId, status: FRIENDSHIP_REQUEST_PENDING },
    orderBy: { createdAt: 'desc' },
  });
}

export async function insertFriendshipPair(
  tx: PrismaTx,
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  await tx.userFriendship.createMany({
    data: [
      { ownerKeyId: keyIdA, friendKeyId: keyIdB },
      { ownerKeyId: keyIdB, friendKeyId: keyIdA },
    ],
    skipDuplicates: true,
  });
}

export async function deleteFriendshipPair(
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

export async function deletePendingRequestsBetween(
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

export function serializeFriendshipRequest(
  row: Prisma.FriendshipRequestGetPayload<object>,
) {
  return {
    requesterKeyId: row.requesterKeyId,
    targetKeyId: row.targetKeyId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
