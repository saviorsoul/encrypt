import { prisma } from '../lib/prisma.js';
import {
  consumeFriendInvitation,
  findPendingInvitationForInviter,
} from '../db/friendInvitations.js';
import {
  areFriends,
  deleteFriendshipPair,
  deletePendingRequestsBetween,
  findFriendshipRequest,
  FRIENDSHIP_REQUEST_PENDING,
  FRIENDSHIP_REQUEST_REJECTED,
  hasFriends,
  insertFriendshipPair,
  listFriendshipsWithPublicKeys,
  listIncomingPendingRequests,
  listOutgoingPendingRequests,
  serializeFriendshipRequest,
  serializeFriendshipRequests,
} from '../db/friendships.js';
import { assertRecipientsRegistered } from '../db/users.js';
import {
  registerRequesterForFriendshipRequest,
  registerTargetForFriendshipRequestAccept,
  registerUserForIncomingFriendshipRequests,
} from './invitationRegistration.js';
import { badRequest, conflict, notFound } from '../lib/httpError.js';

type FriendshipPairInput = {
  requesterKeyId: string;
  requesterPublicKey: { x: string; y: string };
  targetKeyId: string;
  invitationToken: string;
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

async function assertPendingInvitationForRequester(
  requesterKeyId: string,
  invitationToken: string,
): Promise<void> {
  const invitation = await findPendingInvitationForInviter(
    invitationToken,
    requesterKeyId,
  );
  if (!invitation) {
    throw badRequest('Invitation not found or already used.');
  }
}

async function establishMutualFriendship(
  inviterKeyId: string,
  inviteeKeyId: string,
  invitationToken: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await deletePendingRequestsBetween(tx, inviterKeyId, inviteeKeyId);
    await insertFriendshipPair(tx, inviterKeyId, inviteeKeyId, invitationToken);
    await consumeFriendInvitation(tx, invitationToken, inviteeKeyId);
  });
}

export async function createFriendshipRequest(input: FriendshipPairInput) {
  const { requesterKeyId, requesterPublicKey, targetKeyId, invitationToken } =
    input;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);
  if (!(await hasFriends(requesterKeyId))) {
    throw badRequest('Add or accept a friend before sending invitations.');
  }
  await registerRequesterForFriendshipRequest(
    requesterKeyId,
    requesterPublicKey,
    invitationToken,
  );
  await assertRecipientsRegistered([requesterKeyId]);
  await assertPendingInvitationForRequester(requesterKeyId, invitationToken);
  await assertNotAlreadyFriends(requesterKeyId, targetKeyId);

  const existing = await findFriendshipRequest(requesterKeyId, targetKeyId);
  if (existing?.status === FRIENDSHIP_REQUEST_PENDING) {
    const token = existing.invitationToken ?? invitationToken;
    if (!existing.invitationToken) {
      await prisma.friendshipRequest.update({
        where: {
          requesterKeyId_targetKeyId: { requesterKeyId, targetKeyId },
        },
        data: { invitationToken },
      });
    }

    return {
      status: 'pending' as const,
      request: serializeFriendshipRequest({
        ...existing,
        invitationToken: token,
      }),
    };
  }

  const reversePending = await findFriendshipRequest(
    targetKeyId,
    requesterKeyId,
  );
  if (
    reversePending?.status === FRIENDSHIP_REQUEST_PENDING &&
    reversePending.invitationToken
  ) {
    await establishMutualFriendship(
      reversePending.requesterKeyId,
      requesterKeyId,
      reversePending.invitationToken,
    );
    return { status: 'accepted' as const };
  }

  const request = await prisma.friendshipRequest.upsert({
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

  return {
    status: 'pending' as const,
    request: serializeFriendshipRequest({
      ...request,
      invitationToken: request.invitationToken ?? invitationToken,
    }),
  };
}

export async function listFriendshipRequests(
  keyId: string,
  publicKey: { x: string; y: string },
) {
  await registerUserForIncomingFriendshipRequests(keyId, publicKey);
  await assertRecipientsRegistered([keyId]);
  const [incomingRows, outgoingRows] = await Promise.all([
    listIncomingPendingRequests(keyId),
    listOutgoingPendingRequests(keyId),
  ]);
  return {
    incoming: await serializeFriendshipRequests(incomingRows),
    outgoing: await serializeFriendshipRequests(outgoingRows),
  };
}

export async function acceptFriendshipRequest(input: {
  requesterKeyId: string;
  targetKeyId: string;
  targetPublicKey: { x: string; y: string };
}) {
  const { requesterKeyId, targetKeyId, targetPublicKey } = input;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);

  const pending = await findFriendshipRequest(requesterKeyId, targetKeyId);
  if (!pending || pending.status !== FRIENDSHIP_REQUEST_PENDING) {
    throw notFound('Pending friendship request not found.');
  }

  const { invitationToken } = pending;
  if (!invitationToken) {
    throw badRequest(
      'Pending friendship request is missing an invitation. Send a new request.',
    );
  }

  await registerTargetForFriendshipRequestAccept(
    targetKeyId,
    targetPublicKey,
    invitationToken,
  );
  await assertRecipientsRegistered([requesterKeyId, targetKeyId]);

  if (await areFriends(requesterKeyId, targetKeyId)) {
    await prisma.$transaction(async (tx) => {
      await deletePendingRequestsBetween(tx, requesterKeyId, targetKeyId);
      await consumeFriendInvitation(tx, invitationToken, targetKeyId);
    });
    return { status: 'accepted' as const };
  }

  await establishMutualFriendship(requesterKeyId, targetKeyId, invitationToken);
  return { status: 'accepted' as const };
}

export async function rejectFriendshipRequest(input: {
  requesterKeyId: string;
  targetKeyId: string;
  targetPublicKey: { x: string; y: string };
}) {
  const { requesterKeyId, targetKeyId, targetPublicKey } = input;
  assertDistinctKeyIds(requesterKeyId, targetKeyId);
  await registerUserForIncomingFriendshipRequests(targetKeyId, targetPublicKey);
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

  if (!request.invitationToken) {
    throw badRequest('Friendship request is missing an invitation token.');
  }

  return serializeFriendshipRequest({
    ...request,
    invitationToken: request.invitationToken,
  });
}

export async function listFriendships(ownerKeyId: string) {
  await assertRecipientsRegistered([ownerKeyId]);
  const rows = await listFriendshipsWithPublicKeys(ownerKeyId);
  return rows.map(({ friendKeyId, publicKey, createdAt, invitationToken }) => ({
    friendKeyId,
    publicKey,
    invitationToken,
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
