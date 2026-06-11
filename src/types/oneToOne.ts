export type ThreadSide = 'sender' | 'recipient';

export type PartyKeyIds = {
  senderKeyId: string | null;
  recipientKeyId: string | null;
};

export type OneToOneThreadItem = {
  id: string;
  createdAt: number;
  encryptedAt: number;
  side: ThreadSide;
  /** Present only in memory after the user decrypts; never persisted to IndexedDB. */
  text?: string;
  decryptedAt?: number;
  encryptedPayload: string;
};

export function isThreadItemDecrypted(item: OneToOneThreadItem): boolean {
  return item.text !== undefined;
}

/** Wire-format identity of an encrypted manifest body (AES-GCM iv + ciphertext). */
export type EncryptedMessageFingerprint = {
  contentIv: string;
  contentCiphertext: string;
};

export function encryptedMessageFingerprintFromPayloadJson(
  payloadJson: string,
): EncryptedMessageFingerprint | null {
  try {
    const parsed = JSON.parse(payloadJson) as {
      encryptedContent?: { iv?: string; ciphertext?: string };
    };
    const iv = parsed.encryptedContent?.iv;
    const ciphertext = parsed.encryptedContent?.ciphertext;
    if (!iv || !ciphertext) {
      return null;
    }
    return { contentIv: iv, contentCiphertext: ciphertext };
  } catch {
    return null;
  }
}

export function encryptedMessageFingerprintsMatch(
  a: EncryptedMessageFingerprint,
  b: EncryptedMessageFingerprint,
): boolean {
  return (
    a.contentIv === b.contentIv && a.contentCiphertext === b.contentCiphertext
  );
}

export function isEncryptedMessageAlreadyInThread(
  thread: OneToOneThreadItem[],
  fingerprint: EncryptedMessageFingerprint,
): boolean {
  return findThreadItemIdByFingerprint(thread, fingerprint) !== null;
}

export function findThreadItemIdByFingerprint(
  thread: OneToOneThreadItem[],
  fingerprint: EncryptedMessageFingerprint,
): string | null {
  for (const item of thread) {
    const existing = encryptedMessageFingerprintFromPayloadJson(
      item.encryptedPayload,
    );
    if (
      existing !== null &&
      encryptedMessageFingerprintsMatch(existing, fingerprint)
    ) {
      return item.id;
    }
  }
  return null;
}
