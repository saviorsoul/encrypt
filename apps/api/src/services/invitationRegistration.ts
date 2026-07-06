import type { Prisma } from '@prisma/client';
import {
  findPendingInvitationByToken,
  findPendingInvitationForInviter,
} from '../db/friendInvitations.js';
import { listIncomingPendingRequests } from '../db/friendships.js';
import {
  findRegisteredKeyIds,
  registerUser,
  registerUserIfAbsent,
} from '../db/users.js';
import { forbidden } from '../lib/httpError.js';

type EcPublicKeyJson = { x: string; y: string };

export async function registerInviterForNewInvitation(
  inviterKeyId: string,
  inviterPublicKey: EcPublicKeyJson,
): Promise<void> {
  await registerUserIfAbsent({
    keyId: inviterKeyId,
    publicKey: inviterPublicKey as Prisma.InputJsonValue,
  });
}

export async function registerRequesterForFriendshipRequest(
  requesterKeyId: string,
  requesterPublicKey: EcPublicKeyJson,
  invitationToken: string,
): Promise<void> {
  const registered = await findRegisteredKeyIds([requesterKeyId]);
  if (registered.has(requesterKeyId)) {
    return;
  }

  const invitation = await findPendingInvitationForInviter(
    invitationToken,
    requesterKeyId,
  );
  if (!invitation) {
    throw forbidden(
      'Registration requires a valid pending friend invitation token.',
    );
  }

  await registerUser({
    keyId: requesterKeyId,
    publicKey: requesterPublicKey as Prisma.InputJsonValue,
  });
}

export async function registerUserForIncomingFriendshipRequests(
  keyId: string,
  publicKey: EcPublicKeyJson,
): Promise<void> {
  const registered = await findRegisteredKeyIds([keyId]);
  if (registered.has(keyId)) {
    return;
  }

  const incoming = await listIncomingPendingRequests(keyId);
  if (!incoming.some((request) => request.invitationToken)) {
    throw forbidden(
      'Registration requires a pending friend invitation or friendship request.',
    );
  }

  await registerUser({
    keyId,
    publicKey: publicKey as Prisma.InputJsonValue,
  });
}

export async function registerInviteeForFriendInvitationAccept(
  inviteeKeyId: string,
  inviteePublicKey: EcPublicKeyJson,
  token: string,
): Promise<void> {
  const registered = await findRegisteredKeyIds([inviteeKeyId]);
  if (registered.has(inviteeKeyId)) {
    return;
  }

  const invitation = await findPendingInvitationByToken(token);
  if (!invitation) {
    throw forbidden(
      'Registration requires a valid pending friend invitation token.',
    );
  }

  if (invitation.inviterKeyId === inviteeKeyId) {
    throw forbidden('Cannot accept your own invitation.');
  }

  await registerUser({
    keyId: inviteeKeyId,
    publicKey: inviteePublicKey as Prisma.InputJsonValue,
  });
}

export async function registerTargetForFriendshipRequestAccept(
  targetKeyId: string,
  targetPublicKey: EcPublicKeyJson,
  invitationToken: string,
): Promise<void> {
  const registered = await findRegisteredKeyIds([targetKeyId]);
  if (registered.has(targetKeyId)) {
    return;
  }

  if (!invitationToken) {
    throw forbidden(
      'Registration requires a pending friendship request with an invitation token.',
    );
  }

  await registerUser({
    keyId: targetKeyId,
    publicKey: targetPublicKey as Prisma.InputJsonValue,
  });
}
