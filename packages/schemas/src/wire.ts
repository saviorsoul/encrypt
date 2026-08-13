import { AUTH_NONCE_BYTES } from '@encrypt/core/crypto/authProof';
import {
  COMMENT_VERSION,
  COMMENT_WRAP,
} from '@encrypt/core/crypto/commentConstants';
import {
  AES_GCM_IV_BASE64_LENGTH,
  MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
} from '@encrypt/core/constants/contentLimits';
import {
  MANIFEST_VERSION,
  MANIFEST_WRAP,
} from '@encrypt/core/constants/manifestConstants';
import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '@encrypt/core/constants/manifestShare';
import { JWK_THUMBPRINT_SHA256_BASE64URL_LENGTH } from '@encrypt/core/crypto/jwkThumbprint';
import {
  DEFAULT_INBOX_LIMIT,
  MAX_BASE64_FIELD_LENGTH,
  MAX_INBOX_LIMIT,
} from './constants.ts';

/** Standard base64 length for a 12-byte auth nonce (no padding). */
const AUTH_NONCE_WIRE_LENGTH = Math.ceil((AUTH_NONCE_BYTES * 4) / 3);

/** RFC 7638 SHA-256 JWK thumbprint (base64url, no padding). */
export const keyIdProperty = {
  type: 'string',
  minLength: JWK_THUMBPRINT_SHA256_BASE64URL_LENGTH,
  maxLength: JWK_THUMBPRINT_SHA256_BASE64URL_LENGTH,
  pattern: '^[A-Za-z0-9_-]+$',
} as const;

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
      maxLength: AES_GCM_IV_BASE64_LENGTH,
    },
    ciphertext: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
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
    keyId: keyIdProperty,
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
  propertyNames: keyIdProperty,
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

const publicKeyWireSchema = {
  oneOf: [
    { type: 'string', minLength: 1, maxLength: 512 },
    {
      type: 'object',
      additionalProperties: true,
      required: ['x', 'y'],
      properties: {
        x: { type: 'string', minLength: 1, maxLength: 256 },
        y: { type: 'string', minLength: 1, maxLength: 256 },
      },
    },
  ],
} as const;

export const registerUserRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['publicKey'],
  properties: {
    publicKey: publicKeyWireSchema,
  },
} as const;

export const authChallengeRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keyId'],
  properties: {
    keyId: keyIdProperty,
  },
} as const;

export const authChallengeResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nonce', 'expiresAt'],
  properties: {
    nonce: {
      type: 'string',
      minLength: AUTH_NONCE_WIRE_LENGTH,
      maxLength: AUTH_NONCE_WIRE_LENGTH,
    },
    expiresAt: { type: 'integer', minimum: 1 },
  },
} as const;

export const createMessageRequestSchema = {
  type: 'object',
  additionalProperties: false,
  stripAfterValidation: ['messageId'],
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
    /** Feed copy exports include the source row id; stripped before create. */
    messageId: { type: 'string', format: 'uuid' },
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

/** Wire-format inbox query — query string values before coercion/defaults. */
export const inboxQueryWireSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: {
      type: 'string',
      pattern: '^(?:100|[1-9]\\d?)$',
    },
    cursor: { type: 'string', format: 'uuid' },
    sort: { type: 'string', enum: ['date'] },
    order: {
      type: 'string',
      enum: ['asc', 'desc', 'ascending', 'descending'],
    },
  },
} as const;

export const inboxQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_INBOX_LIMIT,
      default: DEFAULT_INBOX_LIMIT,
    },
    cursor: { type: 'string', format: 'uuid' },
    sort: { type: 'string', enum: ['date'], default: 'date' },
    order: {
      type: 'string',
      enumAliases: { ascending: 'asc', descending: 'desc' },
      enum: ['asc', 'desc'],
      default: 'desc',
    },
  },
} as const;

export const friendshipTargetBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['targetKeyId', 'invitationToken'],
  properties: {
    targetKeyId: keyIdProperty,
    invitationToken: { type: 'string', format: 'uuid' },
  },
} as const;

export const friendshipRequesterBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requesterKeyId'],
  properties: {
    requesterKeyId: keyIdProperty,
  },
} as const;

export const deleteFriendshipBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['friendKeyId'],
  properties: {
    friendKeyId: keyIdProperty,
  },
} as const;

export const createFriendInvitationBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

export const acceptFriendInvitationBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;
