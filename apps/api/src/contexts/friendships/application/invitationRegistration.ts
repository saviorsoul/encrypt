import { userRepository } from '@/contexts/users/index.js';
import { forbidden } from '@/lib/httpError.js';
import { friendInvitationRepository } from '@/contexts/friendships/infrastructure/prismaFriendInvitationRepository.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';

type EcPublicKeyJson = { x: string; y: string };

export async function registerInviterForNewInvitation(
  inviterKeyId: string,
  inviterPublicKey: EcPublicKeyJson,
): Promise<void> {
  await userRepository.registerIfAbsent({
    keyId: inviterKeyId,
    publicKey: inviterPublicKey,
  });
}

export async function registerRequesterForFriendshipRequest(
  requesterKeyId: string,
  requesterPublicKey: EcPublicKeyJson,
  invitationToken: string,
): Promise<void> {
  const registered = await userRepository.findRegisteredKeyIds([
    requesterKeyId,
  ]);
  if (registered.has(requesterKeyId)) {
    return;
  }

  const invitation = await friendInvitationRepository.findPendingForInviter(
    invitationToken,
    requesterKeyId,
  );
  if (!invitation) {
    throw forbidden(
      'Registration requires a valid pending friend invitation token.',
    );
  }

  await userRepository.register({
    keyId: requesterKeyId,
    publicKey: requesterPublicKey,
  });
}

export async function registerUserForIncomingFriendshipRequests(
  keyId: string,
  publicKey: EcPublicKeyJson,
): Promise<void> {
  const registered = await userRepository.findRegisteredKeyIds([keyId]);
  if (registered.has(keyId)) {
    return;
  }

  const incoming =
    await friendshipRepository.listIncomingPendingRequests(keyId);
  if (!incoming.some((request) => request.invitationToken)) {
    throw forbidden(
      'Registration requires a pending friend invitation or friendship request.',
    );
  }

  await userRepository.register({
    keyId,
    publicKey,
  });
}

export async function registerInviteeForFriendInvitationAccept(
  inviteeKeyId: string,
  inviteePublicKey: EcPublicKeyJson,
  token: string,
): Promise<void> {
  const registered = await userRepository.findRegisteredKeyIds([inviteeKeyId]);
  if (registered.has(inviteeKeyId)) {
    return;
  }

  const invitation = await friendInvitationRepository.findPendingByToken(token);
  if (!invitation) {
    throw forbidden(
      'Registration requires a valid pending friend invitation token.',
    );
  }

  if (invitation.inviterKeyId === inviteeKeyId) {
    throw forbidden('Cannot accept your own invitation.');
  }

  await userRepository.register({
    keyId: inviteeKeyId,
    publicKey: inviteePublicKey,
  });
}

export async function registerTargetForFriendshipRequestAccept(
  targetKeyId: string,
  targetPublicKey: EcPublicKeyJson,
  invitationToken: string,
): Promise<void> {
  const registered = await userRepository.findRegisteredKeyIds([targetKeyId]);
  if (registered.has(targetKeyId)) {
    return;
  }

  if (!invitationToken) {
    throw forbidden(
      'Registration requires a pending friendship request with an invitation token.',
    );
  }

  await userRepository.register({
    keyId: targetKeyId,
    publicKey: targetPublicKey,
  });
}
