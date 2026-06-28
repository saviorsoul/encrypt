export const MANIFEST_VERSION = 9 as const;
export const MANIFEST_WRAP = 'ephemeral-sender-ecdhe-hkdf-aes' as const;

export const HKDF_INFO = new TextEncoder().encode('manifest-v3:key-wrap');

export const HKDF_SALT_LENGTH = 32;
