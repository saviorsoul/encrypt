/** Practical cap for decrypt JSON in a URL. */
export const MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH = 32 * 1024;

export function buildCopyPublicKeyUrl(): string {
  return 'encrypt://copy-public-key';
}

export function buildEncryptUrl(text: string): string {
  const params = new URLSearchParams();
  params.set('text', text);
  return `encrypt://encrypt?${params.toString()}`;
}

export function buildDecryptUrl(text: string): string {
  const params = new URLSearchParams();
  params.set('text', text);
  return `encrypt://decrypt?${params.toString()}`;
}

export function assertEncryptTextLength(text: string): string | null {
  if (!text) {
    return 'Select some text first.';
  }
  return null;
}

export function assertDecryptTextLength(text: string): string | null {
  if (!text) {
    return 'Select encrypted text first.';
  }
  if (text.length > MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH) {
    return `Selection exceeds ${MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH} characters.`;
  }
  return null;
}
