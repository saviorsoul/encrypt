import type { FriendInvitation } from '@prisma/client';
import { prisma, type PrismaTx } from '../lib/prisma.js';

export const FRIEND_INVITATION_PENDING = 'pending';
export const FRIEND_INVITATION_CONSUMED = 'consumed';

export type SerializedFriendInvitation = {
  token: string;
  inviterKeyId: string;
  status: typeof FRIEND_INVITATION_PENDING | typeof FRIEND_INVITATION_CONSUMED;
  inviteeKeyId: string | null;
  createdAt: string;
  consumedAt: string | null;
};

export async function consumeFriendInvitation(
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

export async function findPendingInvitationForInviter(
  token: string,
  inviterKeyId: string,
) {
  const row = await prisma.friendInvitation.findUnique({
    where: { token },
  });
  if (!row || row.inviterKeyId !== inviterKeyId) {
    return null;
  }
  if (row.status !== FRIEND_INVITATION_PENDING) {
    return null;
  }
  return row;
}

export async function findPendingInvitationByToken(token: string) {
  const row = await prisma.friendInvitation.findUnique({
    where: { token },
  });
  if (!row || row.status !== FRIEND_INVITATION_PENDING) {
    return null;
  }
  return row;
}

export function serializeFriendInvitation(
  row: FriendInvitation,
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
