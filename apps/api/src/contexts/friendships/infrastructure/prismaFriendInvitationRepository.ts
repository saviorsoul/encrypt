import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma.js';
import { FRIEND_INVITATION_PENDING } from '@/contexts/friendships/domain/constants.js';
import type {
  FriendInvitationRecord,
  FriendInvitationRepository,
  SerializedFriendInvitation,
} from '@/contexts/friendships/domain/ports/FriendInvitationRepository.js';

function toRecord(row: {
  token: string;
  inviterKeyId: string;
  status: string;
  inviteeKeyId: string | null;
  createdAt: Date;
  consumedAt: Date | null;
}): FriendInvitationRecord {
  return {
    token: row.token,
    inviterKeyId: row.inviterKeyId,
    status: row.status,
    inviteeKeyId: row.inviteeKeyId,
    createdAt: row.createdAt,
    consumedAt: row.consumedAt,
  };
}

function serializeFriendInvitation(
  row: FriendInvitationRecord,
): SerializedFriendInvitation {
  return {
    token: row.token,
    inviterKeyId: row.inviterKeyId,
    status: row.status as SerializedFriendInvitation['status'],
    inviteeKeyId: row.inviteeKeyId,
    createdAt: row.createdAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null,
  };
}

export const friendInvitationRepository: FriendInvitationRepository = {
  async createInvitation(
    inviterKeyId: string,
  ): Promise<SerializedFriendInvitation> {
    const token = randomUUID();
    const row = await prisma.friendInvitation.create({
      data: {
        token,
        inviterKeyId,
        status: FRIEND_INVITATION_PENDING,
      },
    });
    return serializeFriendInvitation(toRecord(row));
  },

  async findByToken(token: string): Promise<FriendInvitationRecord | null> {
    const row = await prisma.friendInvitation.findUnique({
      where: { token },
    });
    return row ? toRecord(row) : null;
  },

  async findPendingByToken(
    token: string,
  ): Promise<FriendInvitationRecord | null> {
    const row = await prisma.friendInvitation.findUnique({
      where: { token },
    });
    if (!row || row.status !== FRIEND_INVITATION_PENDING) {
      return null;
    }
    return toRecord(row);
  },

  async findPendingForInviter(
    token: string,
    inviterKeyId: string,
  ): Promise<FriendInvitationRecord | null> {
    const row = await prisma.friendInvitation.findUnique({
      where: { token },
    });
    if (!row || row.inviterKeyId !== inviterKeyId) {
      return null;
    }
    if (row.status !== FRIEND_INVITATION_PENDING) {
      return null;
    }
    return toRecord(row);
  },

  async listPendingForInviter(
    inviterKeyId: string,
  ): Promise<FriendInvitationRecord[]> {
    const rows = await prisma.friendInvitation.findMany({
      where: {
        inviterKeyId,
        status: FRIEND_INVITATION_PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  },

  serialize(row: FriendInvitationRecord): SerializedFriendInvitation {
    return serializeFriendInvitation(row);
  },
};
