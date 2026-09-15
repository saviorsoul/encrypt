/**
 * Design target for decrypted message/comment length. Used only to size the
 * ciphertext wire limit below — runtime validation uses ciphertext length.
 */
export const MAX_CONTENT_PLAINTEXT_LENGTH = 2000;

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
 *   bytes = 2000 * 4 + 16 = 8016
 *   base64 = ceil(8016 / 3) * 4 = 10688
 */
export const MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH =
  Math.ceil(
    (MAX_CONTENT_PLAINTEXT_LENGTH * MAX_UTF8_BYTES_PER_CODE_UNIT +
      AES_GCM_TAG_BYTES) /
      3,
  ) * 4;

/** Show characters-left helper once encrypted payload reaches half the wire limit. */
export const CONTENT_CIPHERTEXT_SIZE_HELPER_THRESHOLD = Math.floor(
  MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH / 2,
);

export type ContentPlaintextLimitState = {
  charactersLeft: number;
  overLimit: boolean;
  ciphertextLength: number;
};

function countCharactersToRemove(plaintext: string): number {
  let lo = 1;
  let hi = plaintext.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const trimmed = plaintext.slice(0, plaintext.length - mid);
    if (isContentPlaintextOverLimitByCiphertext(trimmed)) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function isContentPlaintextOverLimitByCiphertext(plaintext: string): boolean {
  if (!plaintext) {
    return false;
  }
  return (
    encryptedContentCiphertextBase64Length(plaintext) >
    MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH
  );
}

/**
 * Single-pass limit state for a draft: characters left, over-limit flag, and
 * ciphertext size (for helper visibility threshold). {@link charactersLeft} may
 * be negative when over the limit (characters to remove).
 */
export function getContentPlaintextLimitState(
  plaintext: string,
): ContentPlaintextLimitState {
  if (!plaintext) {
    return {
      charactersLeft: MAX_CONTENT_PLAINTEXT_LENGTH,
      overLimit: false,
      ciphertextLength: 0,
    };
  }

  const ciphertextLength = encryptedContentCiphertextBase64Length(plaintext);
  let charactersLeft = MAX_CONTENT_PLAINTEXT_LENGTH - plaintext.length;

  if (
    plaintext.length <= MAX_CONTENT_PLAINTEXT_LENGTH &&
    isContentPlaintextOverLimitByCiphertext(plaintext)
  ) {
    charactersLeft = -countCharactersToRemove(plaintext);
  }

  return {
    charactersLeft,
    overLimit: charactersLeft < 0,
    ciphertextLength,
  };
}

export function isContentPlaintextOverLimit(plaintext: string): boolean {
  return getContentPlaintextLimitState(plaintext).overLimit;
}

export function formatContentCharactersLeftCount(
  charactersLeft: number,
): string {
  if (charactersLeft < 0) {
    return `characters over limit: ~${-charactersLeft}`;
  }
  return `characters left: ~${charactersLeft}`;
}

export function formatContentCharactersLeftHelper(plaintext: string): string {
  const { charactersLeft } = getContentPlaintextLimitState(plaintext);
  return formatContentCharactersLeftCount(charactersLeft);
}

/** Helper text when near the limit; undefined below {@link CONTENT_CIPHERTEXT_SIZE_HELPER_THRESHOLD}. */
export function contentCharactersLeftHelperText(
  plaintext: string,
): string | undefined {
  const { charactersLeft, ciphertextLength } =
    getContentPlaintextLimitState(plaintext);
  if (ciphertextLength < CONTENT_CIPHERTEXT_SIZE_HELPER_THRESHOLD) {
    return undefined;
  }
  return formatContentCharactersLeftCount(charactersLeft);
}

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
  if (isContentPlaintextOverLimit(text)) {
    const noun = label === 'comment' ? 'Comment' : 'Message';
    return `${noun} exceeds the maximum length (~${MAX_CONTENT_PLAINTEXT_LENGTH} characters).`;
  }
  return null;
}
