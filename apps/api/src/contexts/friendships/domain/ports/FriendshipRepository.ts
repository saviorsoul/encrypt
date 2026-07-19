import type { EcPublicKey } from '@/contexts/users/index.js';

export type FriendshipRequestRecord = {
  requesterKeyId: string;
  targetKeyId: string;
  invitationToken: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedFriendshipRequest = {
  requesterKeyId: string;
  targetKeyId: string;
  invitationToken: string;
  status: string;
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
  listOutgoingPendingRequests(
    requesterKeyId: string,
  ): Promise<FriendshipRequestRecord[]>;
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
}
