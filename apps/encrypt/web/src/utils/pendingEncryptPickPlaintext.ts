export const PENDING_ENCRYPT_PICK_PLAINTEXT_KEY =
  'encrypt-pending-pick-plaintext';

export function readPendingEncryptPickPlaintext(): string | null {
  try {
    return sessionStorage.getItem(PENDING_ENCRYPT_PICK_PLAINTEXT_KEY);
  } catch {
    return null;
  }
}

export function writePendingEncryptPickPlaintext(text: string | null): void {
  try {
    if (text) {
      sessionStorage.setItem(PENDING_ENCRYPT_PICK_PLAINTEXT_KEY, text);
    } else {
      sessionStorage.removeItem(PENDING_ENCRYPT_PICK_PLAINTEXT_KEY);
    }
  } catch {
    /* ignore quota / privacy mode */
  }
}
