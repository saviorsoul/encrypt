/**
 * Transactional writes that span friendships, requests, and invitations.
 * Kept as its own port so repositories stay single-aggregate.
 */
export interface FriendshipWritePort {
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
}
