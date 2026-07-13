import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import {
  consumeFriendInvitation,
  FRIEND_INVITATION_CONSUMED,
  FRIEND_INVITATION_PENDING,
  serializeFriendInvitation,
} from '../db/friendInvitations.js';
import {
  areFriends,
  deletePendingRequestsBetween,
  hasFriends,
  insertFriendshipPair,
} from '../db/friendships.js';
import {
  registerInviteeForFriendInvitationAccept,
  registerInviterForNewInvitation,
} from './invitationRegistration.js';
import { badRequest, gone, notFound } from '../lib/httpError.js';

type EcPublicKeyJson = { x: string; y: string };

function parseEcPublicKey(value: unknown): EcPublicKeyJson | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.x !== 'string' || typeof record.y !== 'string') {
    return null;
  }
  return { x: record.x, y: record.y };
}

export async function createFriendInvitation(input: {
  inviterKeyId: string;
  inviterPublicKey: EcPublicKeyJson;
}) {
  const { inviterKeyId, inviterPublicKey } = input;
  await registerInviterForNewInvitation(inviterKeyId, inviterPublicKey);

  if (!(await hasFriends(inviterKeyId))) {
    throw badRequest('Add or accept a friend before sending invitations.');
  }

  const token = randomUUID();

  const row = await prisma.friendInvitation.create({
    data: {
      token,
      inviterKeyId,
      status: FRIEND_INVITATION_PENDING,
    },
  });

  return serializeFriendInvitation(row);
}

export async function getFriendInvitation(token: string) {
  const row = await prisma.friendInvitation.findUnique({
    where: { token },
  });
  if (!row) {
    throw notFound('Invitation not found.');
  }

  const inviter = await prisma.user.findUnique({
    where: { keyId: row.inviterKeyId },
    select: { keyId: true, publicKey: true },
  });
  if (!inviter) {
    throw notFound('Invitation not found.');
  }

  const inviterPublicKey = parseEcPublicKey(inviter.publicKey);
  if (!inviterPublicKey) {
    throw notFound('Invitation not found.');
  }

  if (row.status === FRIEND_INVITATION_CONSUMED) {
    throw gone('Invitation already used.', {
      token: row.token,
      status: FRIEND_INVITATION_CONSUMED,
      inviterKeyId: row.inviterKeyId,
      inviteeKeyId: row.inviteeKeyId,
      consumedAt: row.consumedAt?.toISOString() ?? null,
    });
  }

  return {
    token: row.token,
    status: 'pending',
    inviterKeyId: row.inviterKeyId,
    inviterPublicKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function acceptFriendInvitation(input: {
  token: string;
  inviteeKeyId: string;
  inviteePublicKey: EcPublicKeyJson;
}) {
  const { token, inviteeKeyId, inviteePublicKey } = input;

  const row = await prisma.friendInvitation.findUnique({
    where: { token },
  });
  if (!row) {
    throw notFound('Invitation not found.');
  }

  if (row.status === FRIEND_INVITATION_CONSUMED) {
    throw gone('Invitation already used.');
  }

  if (row.inviterKeyId === inviteeKeyId) {
    throw badRequest('Cannot accept your own invitation.');
  }

  await registerInviteeForFriendInvitationAccept(
    inviteeKeyId,
    inviteePublicKey,
    token,
  );

  const inviterRegistered = await prisma.user.findUnique({
    where: { keyId: row.inviterKeyId },
    select: { keyId: true },
  });
  if (!inviterRegistered) {
    throw badRequest(
      'Invitation inviter is not registered. Ask them to create a new invitation link.',
    );
  }

  await prisma.$transaction(async (tx) => {
    if (!(await areFriends(row.inviterKeyId, inviteeKeyId))) {
      await deletePendingRequestsBetween(tx, row.inviterKeyId, inviteeKeyId);
      await insertFriendshipPair(tx, row.inviterKeyId, inviteeKeyId, token);
    }

    await consumeFriendInvitation(tx, token, inviteeKeyId);
  });

  return { status: 'accepted' as const };
}
