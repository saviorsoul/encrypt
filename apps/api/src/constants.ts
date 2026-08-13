/** Mirrors apps/web MAX_IMPORT_JSON_FILE_BYTES — bodyParser jsonLimit. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

export const MANIFEST_VERSION = 9 as const;
export const MANIFEST_WRAP = 'ephemeral-sender-ecdhe-hkdf-aes' as const;

export const MANIFEST_SHARE_VERSION = 1 as const;
export const MANIFEST_SHARE_WRAP = 'manifest-share-v1' as const;

export const COMMENT_VERSION = 1 as const;
export const COMMENT_WRAP = 'message-bound-aes' as const;

export {
  DEFAULT_INBOX_LIMIT,
  MAX_BASE64_FIELD_LENGTH,
  MAX_INBOX_LIMIT,
} from '@encrypt/schemas';

export {
  AES_GCM_IV_BASE64_LENGTH,
  MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
  MAX_CONTENT_PLAINTEXT_LENGTH,
} from '@encrypt/core/constants/contentLimits';
