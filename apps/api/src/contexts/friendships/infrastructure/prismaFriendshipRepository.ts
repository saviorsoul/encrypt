import { prisma } from '@/lib/prisma.js';
import { userRepository } from '@/contexts/users/index.js';
import {
  FRIENDSHIP_REQUEST_PENDING,
  FRIENDSHIP_REQUEST_REJECTED,
} from '@/contexts/friendships/domain/constants.js';
import type {
  FriendshipRepository,
  FriendshipRequestRecord,
  FriendshipWithPublicKey,
  SerializedFriendshipRequest,
} from '@/contexts/friendships/domain/ports/FriendshipRepository.js';

function toRecord(row: {
  requesterKeyId: string;
  targetKeyId: string;
  invitationToken: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): FriendshipRequestRecord {
  return {
    requesterKeyId: row.requesterKeyId,
    targetKeyId: row.targetKeyId,
    invitationToken: row.invitationToken,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeFriendshipRequest(
  row: FriendshipRequestRecord & { invitationToken: string },
): SerializedFriendshipRequest {
  return {
    requesterKeyId: row.requesterKeyId,
    targetKeyId: row.targetKeyId,
    invitationToken: row.invitationToken,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const friendshipRepository: FriendshipRepository = {
  async hasFriends(ownerKeyId: string): Promise<boolean> {
    const row = await prisma.userFriendship.findFirst({
      where: { ownerKeyId },
      select: { ownerKeyId: true },
    });
    return row != null;
  },

  async areFriends(keyIdA: string, keyIdB: string): Promise<boolean> {
    const row = await prisma.userFriendship.findUnique({
      where: {
        ownerKeyId_friendKeyId: { ownerKeyId: keyIdA, friendKeyId: keyIdB },
      },
      select: { ownerKeyId: true },
    });
    return row != null;
  },

  async listFriendshipsWithPublicKeys(
    ownerKeyId: string,
  ): Promise<FriendshipWithPublicKey[]> {
    const friendships = await prisma.userFriendship.findMany({
      where: { ownerKeyId },
      select: {
        friendKeyId: true,
        createdAt: true,
        invitationToken: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (friendships.length === 0) {
      return [];
    }

    const friendKeyIds = friendships.map((row) => row.friendKeyId);
    const publicKeyByKeyId =
      await userRepository.findPublicKeysByKeyIds(friendKeyIds);

    return friendships
      .map((friendship) => {
        const publicKey = publicKeyByKeyId.get(friendship.friendKeyId);
        if (!publicKey) {
          return null;
        }
        return {
          friendKeyId: friendship.friendKeyId,
          publicKey,
          createdAt: friendship.createdAt,
          invitationToken: friendship.invitationToken,
        };
      })
      .filter((row): row is FriendshipWithPublicKey => row !== null);
  },

  async findFriendshipRequest(
    requesterKeyId: string,
    targetKeyId: string,
  ): Promise<FriendshipRequestRecord | null> {
    const row = await prisma.friendshipRequest.findUnique({
      where: {
        requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
      },
    });
    return row ? toRecord(row) : null;
  },

  async listIncomingPendingRequests(
    targetKeyId: string,
  ): Promise<FriendshipRequestRecord[]> {
    const rows = await prisma.friendshipRequest.findMany({
      where: {
        targetKeyId,
        status: FRIENDSHIP_REQUEST_PENDING,
        invitationToken: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  },

  async listPendingRequestsForUser(keyId: string): Promise<{
    incoming: FriendshipRequestRecord[];
    outgoing: FriendshipRequestRecord[];
  }> {
    const rows = await prisma.friendshipRequest.findMany({
      where: {
        status: FRIENDSHIP_REQUEST_PENDING,
        invitationToken: { not: null },
        OR: [{ targetKeyId: keyId }, { requesterKeyId: keyId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const incoming: FriendshipRequestRecord[] = [];
    const outgoing: FriendshipRequestRecord[] = [];
    for (const row of rows) {
      const record = toRecord(row);
      if (row.targetKeyId === keyId) {
        incoming.push(record);
      }
      if (row.requesterKeyId === keyId) {
        outgoing.push(record);
      }
    }
    return { incoming, outgoing };
  },

  async upsertPendingRequest(
    requesterKeyId: string,
    targetKeyId: string,
    invitationToken: string,
  ): Promise<FriendshipRequestRecord> {
    const row = await prisma.friendshipRequest.upsert({
      where: {
        requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
      },
      create: {
        requesterKeyId,
        targetKeyId,
        invitationToken,
        status: FRIENDSHIP_REQUEST_PENDING,
      },
      update: {
        invitationToken,
        status: FRIENDSHIP_REQUEST_PENDING,
      },
    });
    return toRecord(row);
  },

  async ensureInvitationTokenOnPendingRequest(
    requesterKeyId: string,
    targetKeyId: string,
    invitationToken: string,
  ): Promise<void> {
    await prisma.friendshipRequest.update({
      where: {
        requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
      },
      data: { invitationToken },
    });
  },

  async markRejected(
    requesterKeyId: string,
    targetKeyId: string,
  ): Promise<FriendshipRequestRecord> {
    const row = await prisma.friendshipRequest.update({
      where: {
        requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
      },
      data: { status: FRIENDSHIP_REQUEST_REJECTED },
    });
    return toRecord(row);
  },

  serializeFriendshipRequest(
    row: FriendshipRequestRecord & { invitationToken: string },
  ): SerializedFriendshipRequest {
    return serializeFriendshipRequest(row);
  },

  serializeFriendshipRequests(
    rows: FriendshipRequestRecord[],
  ): SerializedFriendshipRequest[] {
    const validRows = rows.filter(
      (row): row is FriendshipRequestRecord & { invitationToken: string } =>
        row.invitationToken != null && row.invitationToken !== '',
    );
    return validRows.map(serializeFriendshipRequest);
  },
};
