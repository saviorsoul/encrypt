export type AuthChallengeRequest = {
  keyId: string;
};

export type AuthChallengeResponse = {
  nonce: string;
  expiresAt: number;
};

export type CreateShareRequest = {
  share: Record<string, unknown>;
  keyManifest: Record<string, Record<string, unknown>>;
  messageId?: string;
  parentMessage?: Record<string, unknown>;
};

export type RegisterUserRequest = {
  publicKey: string | Record<string, unknown>;
};

export type CommentPayloadBody = Record<string, unknown>;

export type CreateMessageRequest = {
  version: number;
  wrap: string;
  senderPublicJwk: Record<string, unknown>;
  ephemeralPublicKey: Record<string, unknown>;
  encryptedContent: Record<string, unknown>;
  senderSignature: string;
  keyManifest: Record<string, Record<string, unknown>>;
};

export type FriendshipTargetBody = {
  targetKeyId: string;
  invitationToken: string;
};

export type FriendshipRequesterBody = {
  requesterKeyId: string;
};

export type DeleteFriendshipBody = {
  friendKeyId: string;
};

export type CreateFriendInvitationBody = Record<string, never>;

export type AcceptFriendInvitationBody = Record<string, never>;
