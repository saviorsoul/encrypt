import {
  COMMENT_VERSION,
  COMMENT_WRAP,
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
  MANIFEST_VERSION,
  MANIFEST_WRAP,
  MAX_BASE64_FIELD_LENGTH,
} from '../constants.js';

export const ecPublicJwkSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['kty', 'crv', 'x', 'y'],
  properties: {
    kty: { type: 'string', const: 'EC' },
    crv: { type: 'string', const: 'P-256' },
    x: { type: 'string', minLength: 1, maxLength: 256 },
    y: { type: 'string', minLength: 1, maxLength: 256 },
  },
} as const;

export const encryptedContentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['iv', 'ciphertext'],
  properties: {
    iv: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
    ciphertext: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
  },
} as const;

export const manifestCoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'wrap',
    'senderPublicJwk',
    'ephemeralPublicKey',
    'encryptedContent',
    'senderSignature',
  ],
  properties: {
    version: { type: 'integer', const: MANIFEST_VERSION },
    wrap: { type: 'string', const: MANIFEST_WRAP },
    senderPublicJwk: ecPublicJwkSchema,
    ephemeralPublicKey: ecPublicJwkSchema,
    encryptedContent: encryptedContentSchema,
    senderSignature: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
  },
} as const;

export const manifestShareWireSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'wrap',
    'parentMessageId',
    'sharerPublicJwk',
    'ephemeralPublicKey',
    'sharerSignature',
  ],
  properties: {
    version: { type: 'integer', const: MANIFEST_SHARE_VERSION },
    wrap: { type: 'string', const: MANIFEST_SHARE_WRAP },
    parentMessageId: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
    },
    sharerPublicJwk: ecPublicJwkSchema,
    ephemeralPublicKey: ecPublicJwkSchema,
    sharerSignature: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
  },
} as const;

export const keyManifestRecipientSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keyId', 'iv', 'salt', 'encryptedDek'],
  properties: {
    keyId: { type: 'string', minLength: 1, maxLength: 128 },
    publicKey: ecPublicJwkSchema,
    iv: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
    salt: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
    encryptedDek: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
  },
} as const;

export const keyManifestSchema = {
  type: 'object',
  additionalProperties: keyManifestRecipientSchema,
  minProperties: 1,
} as const;

export const commentPayloadSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'wrap',
    'messageId',
    'senderPublicJwk',
    'salt',
    'encryptedContent',
    'senderSignature',
  ],
  properties: {
    version: { type: 'integer', const: COMMENT_VERSION },
    wrap: { type: 'string', const: COMMENT_WRAP },
    messageId: { type: 'string', format: 'uuid' },
    senderPublicJwk: ecPublicJwkSchema,
    salt: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
    encryptedContent: encryptedContentSchema,
    senderSignature: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
  },
} as const;

export const createShareRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['share', 'keyManifest'],
  properties: {
    share: manifestShareWireSchema,
    keyManifest: keyManifestSchema,
    messageId: { type: 'string', format: 'uuid' },
    parentMessage: manifestCoreSchema,
  },
} as const;

export const registerUserRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keyId', 'publicKey'],
  properties: {
    keyId: { type: 'string', minLength: 1, maxLength: 128 },
    publicKey: ecPublicJwkSchema,
  },
} as const;

export const createMessageRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'wrap',
    'senderPublicJwk',
    'ephemeralPublicKey',
    'encryptedContent',
    'senderSignature',
    'keyManifest',
  ],
  properties: {
    version: { type: 'integer', const: MANIFEST_VERSION },
    wrap: { type: 'string', const: MANIFEST_WRAP },
    senderPublicJwk: ecPublicJwkSchema,
    ephemeralPublicKey: ecPublicJwkSchema,
    encryptedContent: encryptedContentSchema,
    senderSignature: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_BASE64_FIELD_LENGTH,
    },
    keyManifest: keyManifestSchema,
  },
} as const;

export type CreateShareRequest = {
  share: Record<string, unknown>;
  keyManifest: Record<string, Record<string, unknown>>;
  messageId?: string;
  parentMessage?: Record<string, unknown>;
};

export type RegisterUserRequest = {
  keyId: string;
  publicKey: Record<string, unknown>;
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

export const recipientKeyIdQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['recipientKeyId'],
  properties: {
    recipientKeyId: { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const;

export const commentsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['messageId'],
  properties: {
    messageId: { type: 'string', format: 'uuid' },
  },
} as const;

/** Wire schemas for AJV — replace with @encrypt/schemas imports in step 2. */
export const schemaDefinitions = {
  createShareRequest: createShareRequestSchema,
  createMessageRequest: createMessageRequestSchema,
  commentPayload: commentPayloadSchema,
  registerUserRequest: registerUserRequestSchema,
  recipientKeyIdQuery: recipientKeyIdQuerySchema,
  commentsQuery: commentsQuerySchema,
} as const;

export type SchemaName = keyof typeof schemaDefinitions;

/** Satisfies AJV typing for compile(); wire schemas move to @encrypt/schemas in step 2. */
export type SchemaRegistry = typeof schemaDefinitions;
