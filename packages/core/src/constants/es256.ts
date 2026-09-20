/**
 * ECDSA P-256 / SHA-256 (ES256) signature sizes for Web Crypto `subtle.sign` /
 * `subtle.verify` (IEEE P1363: 32-byte r || 32-byte s).
 */
export const ES256_SIGNATURE_BYTES = 64;

/** Standard base64 wire length for {@link ES256_SIGNATURE_BYTES} (includes `==` padding). */
export const ES256_SIGNATURE_BASE64_LENGTH =
  4 * Math.ceil(ES256_SIGNATURE_BYTES / 3);

/** Payload characters before standard base64 padding for {@link ES256_SIGNATURE_BYTES}. */
export const ES256_SIGNATURE_BASE64_BODY_LENGTH =
  ES256_SIGNATURE_BASE64_LENGTH - 2;

/** Standard base64 alphabet + `==` padding for a 64-byte ES256 signature. */
export const ES256_SIGNATURE_BASE64_PATTERN = `^[A-Za-z0-9+/]{${ES256_SIGNATURE_BASE64_BODY_LENGTH}}==$`;
