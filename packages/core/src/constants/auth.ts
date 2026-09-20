export const AUTH_SIGNABLE_VERSION = 2;
export const AUTH_TIME_SLOT_SECONDS = 30;
/** Accepted client slots: serverSlot ± AUTH_TIME_SLOT_SKEW */
export const AUTH_TIME_SLOT_SKEW = 1;
export const AUTH_NONCE_TTL_SECONDS = 15 * 60;
/** Re-bootstrap when fewer than this many seconds remain before server/client nonce expiry. */
export const AUTH_NONCE_MIN_REMAINING_SECONDS = 30;
/** Random auth nonce length in bytes (wire form is standard base64, like manifest IVs). */
export const AUTH_NONCE_BYTES = 12;

export const AUTH_HEADER_KEY_ID = 'X-Key-Id';
export const AUTH_HEADER_PUBLIC_KEY = 'X-Public-Key';
export const AUTH_HEADER_TIME_SLOT = 'X-Time-Slot';
export const AUTH_HEADER_NONCE = 'X-Nonce';
export const AUTH_HEADER_NEXT_NONCE = 'X-Next-Nonce';
export const AUTH_HEADER_NEXT_NONCE_EXPIRES_AT = 'X-Next-Nonce-Expires-At';
export const AUTH_HEADER_SIGNATURE = 'X-Signature';
