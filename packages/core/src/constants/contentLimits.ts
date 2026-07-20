/**
 * Design target for decrypted message/comment length. Used only to size the
 * ciphertext wire limit below — runtime validation uses ciphertext length.
 */
export const MAX_CONTENT_PLAINTEXT_LENGTH = 500;

/** AES-GCM auth tag appended to ciphertext by Web Crypto (bytes). */
export const AES_GCM_TAG_BYTES = 16;

/** AES-GCM IV size used for message/comment body encryption (bytes). */
export const AES_GCM_IV_BYTES = 12;

/**
 * Worst-case UTF-8 bytes per JS string code unit when encoding plaintext.
 * Non-BMP code points use a surrogate pair (2 units → 4 UTF-8 bytes); BMP
 * ideographs use 1 unit → up to 3 bytes. 4 is the safe per-unit ceiling.
 */
export const MAX_UTF8_BYTES_PER_CODE_UNIT = 4;

/**
 * Max base64 length of `encryptedContent.ciphertext`.
 *
 * Shared by API schema and feed-lab (same rule both sides).
 *
 * Wire format: base64(AES-GCM(plaintext) || 16-byte tag); IV is a sibling field.
 * Sized for MAX_CONTENT_PLAINTEXT_LENGTH worst-case UTF-8:
 *   bytes = 500 * 4 + 16 = 2016
 *   base64 = ceil(2016 / 3) * 4 = 2688
 */
export const MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH =
  Math.ceil(
    (MAX_CONTENT_PLAINTEXT_LENGTH * MAX_UTF8_BYTES_PER_CODE_UNIT +
      AES_GCM_TAG_BYTES) /
      3,
  ) * 4;

/** Standard base64 length of a 12-byte IV (with padding). */
export const AES_GCM_IV_BASE64_LENGTH = Math.ceil((AES_GCM_IV_BYTES * 4) / 3);

/**
 * Base64 length of `encryptedContent.ciphertext` after AES-GCM encrypt of `plaintext`.
 * Matches Web Crypto: UTF-8 plaintext bytes + 16-byte auth tag, then standard base64.
 */
export function encryptedContentCiphertextBase64Length(
  plaintext: string,
): number {
  const utf8Bytes = new TextEncoder().encode(plaintext).byteLength;
  return Math.ceil((utf8Bytes + AES_GCM_TAG_BYTES) / 3) * 4;
}

/**
 * Returns an error if plaintext is empty or its encrypted ciphertext would
 * exceed {@link MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH} (same limit as the API).
 */
export function validateContentPlaintext(
  text: string,
  label: 'message' | 'comment' = 'message',
): string | null {
  if (!text.trim()) {
    return label === 'comment' ? 'Enter a comment.' : 'Enter a message.';
  }
  if (
    encryptedContentCiphertextBase64Length(text) >
    MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH
  ) {
    const noun = label === 'comment' ? 'Comment' : 'Message';
    return `${noun} exceeds the maximum encrypted size (${MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH} characters).`;
  }
  return null;
}
