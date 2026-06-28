export const COMMENT_VERSION = 1 as const;
export const COMMENT_WRAP = 'message-bound-aes' as const;

export const COMMENT_HKDF_INFO = new TextEncoder().encode('comment-v1:content');
