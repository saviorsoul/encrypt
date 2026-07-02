import { prisma } from '../lib/prisma.js';
import {
  areFriends,
  deleteFriendshipPair,
  deletePendingRequestsBetween,
  findFriendshipRequest,
  FRIENDSHIP_REQUEST_PENDING,
  FRIENDSHIP_REQUEST_REJECTED,
  insertFriendshipPair,
  listFriendshipsWithPublicKeys,
  listIncomingPendingRequests,
  listOutgoingPendingRequests,
  serializeFriendshipRequest,
} from '../db/friendships.js';
import { assertRecipientsRegistered } from '../db/users.js';
import { badRequest, conflict, notFound } from '../lib/httpError.js';

type FriendshipPairInput = {
  requesterKeyId: string;
  targetKeyId: string;
};

function assertDistinctKeyIds(keyIdA: string, keyIdB: string): void {
  if (keyIdA === keyIdB) {
    throw badRequest('Cannot create a friendship with yourself.');
  }
}

async function assertNotAlreadyFriends(
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  if (await areFriends(keyIdA, keyIdB)) {
    throw conflict('Users are already friends.');
  }
}

async function establishMutualFriendship(
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await deletePendingRequestsBetween(tx, keyIdA, keyIdB);
    await insertFriendshipPair(tx, keyIdA, keyIdB);
  });
}

export async function createFriendshipRequest(input: FriendshipPairInput) {
  const { requesterKeyId, targetKeyId } = input;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);
  await assertRecipientsRegistered([requesterKeyId, targetKeyId]);
  await assertNotAlreadyFriends(requesterKeyId, targetKeyId);

  const existing = await findFriendshipRequest(requesterKeyId, targetKeyId);
  if (existing?.status === FRIENDSHIP_REQUEST_PENDING) {
    return {
      status: 'pending' as const,
      request: serializeFriendshipRequest(existing),
    };
  }

  const reversePending = await findFriendshipRequest(
    targetKeyId,
    requesterKeyId,
  );
  if (reversePending?.status === FRIENDSHIP_REQUEST_PENDING) {
    await establishMutualFriendship(requesterKeyId, targetKeyId);
    return { status: 'accepted' as const };
  }

  const request = await prisma.friendshipRequest.upsert({
    where: {
      requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
    },
    create: {
      requesterKeyId,
      targetKeyId,
      status: FRIENDSHIP_REQUEST_PENDING,
    },
    update: {
      status: FRIENDSHIP_REQUEST_PENDING,
    },
  });

  return {
    status: 'pending' as const,
    request: serializeFriendshipRequest(request),
  };
}

export async function listFriendshipRequests(keyId: string) {
  await assertRecipientsRegistered([keyId]);
  const [incomingRows, outgoingRows] = await Promise.all([
    listIncomingPendingRequests(keyId),
    listOutgoingPendingRequests(keyId),
  ]);
  return {
    incoming: incomingRows.map(serializeFriendshipRequest),
    outgoing: outgoingRows.map(serializeFriendshipRequest),
  };
}

export async function acceptFriendshipRequest(input: FriendshipPairInput) {
  const { requesterKeyId, targetKeyId } = input;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);
  await assertRecipientsRegistered([requesterKeyId, targetKeyId]);

  const pending = await findFriendshipRequest(requesterKeyId, targetKeyId);
  if (!pending || pending.status !== FRIENDSHIP_REQUEST_PENDING) {
    throw notFound('Pending friendship request not found.');
  }

  if (await areFriends(requesterKeyId, targetKeyId)) {
    await prisma.$transaction(async (tx) => {
      await deletePendingRequestsBetween(tx, requesterKeyId, targetKeyId);
    });
    return { status: 'accepted' as const };
  }

  await establishMutualFriendship(requesterKeyId, targetKeyId);
  return { status: 'accepted' as const };
}

export async function rejectFriendshipRequest(input: FriendshipPairInput) {
  const { requesterKeyId, targetKeyId } = input;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);
  await assertRecipientsRegistered([requesterKeyId, targetKeyId]);

  const pending = await findFriendshipRequest(requesterKeyId, targetKeyId);
  if (!pending || pending.status !== FRIENDSHIP_REQUEST_PENDING) {
    throw notFound('Pending friendship request not found.');
  }

  const request = await prisma.friendshipRequest.update({
    where: {
      requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
    },
    data: { status: FRIENDSHIP_REQUEST_REJECTED },
  });

  return serializeFriendshipRequest(request);
}

export async function listFriendships(ownerKeyId: string) {
  await assertRecipientsRegistered([ownerKeyId]);
  const rows = await listFriendshipsWithPublicKeys(ownerKeyId);
  return rows.map(({ friendKeyId, publicKey, createdAt }) => ({
    friendKeyId,
    publicKey,
    createdAt: createdAt.toISOString(),
  }));
}

export async function deleteFriendship(input: {
  ownerKeyId: string;
  friendKeyId: string;
}) {
  const { ownerKeyId, friendKeyId } = input;
  assertDistinctKeyIds(ownerKeyId, friendKeyId);
  await assertRecipientsRegistered([ownerKeyId, friendKeyId]);

  if (!(await areFriends(ownerKeyId, friendKeyId))) {
    throw notFound('Friendship not found.');
  }

  await prisma.$transaction(async (tx) => {
    await deleteFriendshipPair(tx, ownerKeyId, friendKeyId);
  });
}
