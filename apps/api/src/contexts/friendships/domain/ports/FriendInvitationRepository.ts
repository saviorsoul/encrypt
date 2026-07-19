export type FriendInvitationRecord = {
  token: string;
  inviterKeyId: string;
  status: string;
  inviteeKeyId: string | null;
  createdAt: Date;
  consumedAt: Date | null;
};

export type SerializedFriendInvitation = {
  token: string;
  inviterKeyId: string;
  status: 'pending' | 'consumed';
  inviteeKeyId: string | null;
  createdAt: string;
  consumedAt: string | null;
};

export interface FriendInvitationRepository {
  createInvitation(inviterKeyId: string): Promise<SerializedFriendInvitation>;
  findByToken(token: string): Promise<FriendInvitationRecord | null>;
  findPendingByToken(token: string): Promise<FriendInvitationRecord | null>;
  findPendingForInviter(
    token: string,
    inviterKeyId: string,
  ): Promise<FriendInvitationRecord | null>;
  serialize(row: FriendInvitationRecord): SerializedFriendInvitation;
}
