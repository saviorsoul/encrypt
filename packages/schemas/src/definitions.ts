import {
  acceptFriendInvitationBodySchema,
  authChallengeRequestSchema,
  authChallengeResponseSchema,
  authoredMessagesQuerySchema,
  commentPayloadSchema,
  commentsQuerySchema,
  createFriendInvitationBodySchema,
  createMessageRequestSchema,
  createShareRequestSchema,
  createShareBatchRequestSchema,
  deleteFriendshipBodySchema,
  friendshipRequesterBodySchema,
  friendshipTargetBodySchema,
  inboxQuerySchema,
  inboxQueryWireSchema,
  markMessageHistorySharedBodySchema,
  authoredMessagesQueryWireSchema,
  registerUserRequestSchema,
} from './wire';

export const schemaDefinitions = {
  createShareRequest: createShareRequestSchema,
  createShareBatchRequest: createShareBatchRequestSchema,
  createMessageRequest: createMessageRequestSchema,
  commentPayload: commentPayloadSchema,
  registerUserRequest: registerUserRequestSchema,
  authChallengeRequest: authChallengeRequestSchema,
  authChallengeResponse: authChallengeResponseSchema,
  friendshipTargetBody: friendshipTargetBodySchema,
  friendshipRequesterBody: friendshipRequesterBodySchema,
  deleteFriendshipBody: deleteFriendshipBodySchema,
  markMessageHistorySharedBody: markMessageHistorySharedBodySchema,
  createFriendInvitationBody: createFriendInvitationBodySchema,
  acceptFriendInvitationBody: acceptFriendInvitationBodySchema,
} as const;

export const querySchemaDefinitions = {
  commentsQuery: commentsQuerySchema,
  inboxQuery: inboxQuerySchema,
  authoredMessagesQuery: authoredMessagesQuerySchema,
} as const;

export const queryWireSchemaDefinitions = {
  commentsQuery: commentsQuerySchema,
  inboxQuery: inboxQueryWireSchema,
  authoredMessagesQuery: authoredMessagesQueryWireSchema,
} as const;

export type SchemaName = keyof typeof schemaDefinitions;
export type QuerySchemaName = keyof typeof querySchemaDefinitions;

export type SchemaRegistry = typeof schemaDefinitions;
