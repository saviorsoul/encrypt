import type { EcPublicKey } from '@/contexts/users/index.js';
import type { PrismaTx } from '@/lib/prisma.js';

export type FriendshipRequestRecord = {
  requesterKeyId: string;
  targetKeyId: string;
  invitationToken: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedFriendshipRequest = Omit<
  FriendshipRequestRecord,
  'invitationToken' | 'createdAt' | 'updatedAt'
> & {
  invitationToken: string;
  createdAt: string;
  updatedAt: string;
};

export type FriendshipWithPublicKey = {
  friendKeyId: string;
  publicKey: EcPublicKey;
  createdAt: Date;
  invitationToken: string | null;
};

export interface FriendshipRepository {
  hasFriends(ownerKeyId: string): Promise<boolean>;
  areFriends(keyIdA: string, keyIdB: string): Promise<boolean>;
  listFriendshipsWithPublicKeys(
    ownerKeyId: string,
  ): Promise<FriendshipWithPublicKey[]>;
  findFriendshipRequest(
    requesterKeyId: string,
    targetKeyId: string,
  ): Promise<FriendshipRequestRecord | null>;
  listIncomingPendingRequests(
    targetKeyId: string,
  ): Promise<FriendshipRequestRecord[]>;
  listPendingRequestsForUser(keyId: string): Promise<{
    incoming: FriendshipRequestRecord[];
    outgoing: FriendshipRequestRecord[];
  }>;
  upsertPendingRequest(
    requesterKeyId: string,
    targetKeyId: string,
    invitationToken: string,
  ): Promise<FriendshipRequestRecord>;
  ensureInvitationTokenOnPendingRequest(
    requesterKeyId: string,
    targetKeyId: string,
    invitationToken: string,
  ): Promise<void>;
  markRejected(
    requesterKeyId: string,
    targetKeyId: string,
  ): Promise<FriendshipRequestRecord>;
  serializeFriendshipRequest(
    row: FriendshipRequestRecord & { invitationToken: string },
  ): SerializedFriendshipRequest;
  serializeFriendshipRequests(
    rows: FriendshipRequestRecord[],
  ): SerializedFriendshipRequest[];

  establishMutualFriendship(
    inviterKeyId: string,
    inviteeKeyId: string,
    invitationToken: string,
  ): Promise<void>;
  clearPendingAndConsumeInvitation(
    keyIdA: string,
    keyIdB: string,
    invitationToken: string,
    inviteeKeyId: string,
  ): Promise<void>;
  deleteFriendship(ownerKeyId: string, friendKeyId: string): Promise<void>;
  acceptFriendInvitationEstablishingFriendship(
    inviterKeyId: string,
    inviteeKeyId: string,
    token: string,
  ): Promise<void>;
  deleteFriendshipRequestsForKeyId(keyId: string, tx?: PrismaTx): Promise<void>;
  deleteFriendshipsForKeyId(keyId: string, tx?: PrismaTx): Promise<void>;
}
