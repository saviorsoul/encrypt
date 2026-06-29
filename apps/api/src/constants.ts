/** Mirrors apps/web MAX_IMPORT_JSON_FILE_BYTES — bodyParser jsonLimit. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

export const MANIFEST_VERSION = 9 as const;
export const MANIFEST_WRAP = 'ephemeral-sender-ecdhe-hkdf-aes' as const;

export const MANIFEST_SHARE_VERSION = 1 as const;
export const MANIFEST_SHARE_WRAP = 'manifest-share-v1' as const;

export const COMMENT_VERSION = 1 as const;
export const COMMENT_WRAP = 'message-bound-aes' as const;

/** Max decoded base64 payload field length (generous wire limit). */
export const MAX_BASE64_FIELD_LENGTH = 1_048_576;
