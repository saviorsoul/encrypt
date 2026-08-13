import {
  acceptFriendInvitationBodySchema,
  authChallengeRequestSchema,
  authChallengeResponseSchema,
  commentPayloadSchema,
  commentsQuerySchema,
  createFriendInvitationBodySchema,
  createMessageRequestSchema,
  createShareRequestSchema,
  deleteFriendshipBodySchema,
  friendshipRequesterBodySchema,
  friendshipTargetBodySchema,
  inboxQuerySchema,
  inboxQueryWireSchema,
  registerUserRequestSchema,
} from './wire';

export const schemaDefinitions = {
  createShareRequest: createShareRequestSchema,
  createMessageRequest: createMessageRequestSchema,
  commentPayload: commentPayloadSchema,
  registerUserRequest: registerUserRequestSchema,
  authChallengeRequest: authChallengeRequestSchema,
  authChallengeResponse: authChallengeResponseSchema,
  friendshipTargetBody: friendshipTargetBodySchema,
  friendshipRequesterBody: friendshipRequesterBodySchema,
  deleteFriendshipBody: deleteFriendshipBodySchema,
  createFriendInvitationBody: createFriendInvitationBodySchema,
  acceptFriendInvitationBody: acceptFriendInvitationBodySchema,
} as const;

export const querySchemaDefinitions = {
  commentsQuery: commentsQuerySchema,
  inboxQuery: inboxQuerySchema,
} as const;

export const queryWireSchemaDefinitions = {
  commentsQuery: commentsQuerySchema,
  inboxQuery: inboxQueryWireSchema,
} as const;

export type SchemaName = keyof typeof schemaDefinitions;
export type QuerySchemaName = keyof typeof querySchemaDefinitions;

export type SchemaRegistry = typeof schemaDefinitions;
