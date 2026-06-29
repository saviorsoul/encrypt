export * from '@encrypt/core/crypto/commentCrypto';

import { encryptCommentWithMessageKey as encryptCommentWithAccess } from '@encrypt/core/crypto/commentCrypto';
import { decryptComment as decryptCommentWithAccess } from '@encrypt/core/crypto/commentCrypto';
import { resolveParentMessageAccess } from '@/crypto/manifestShare.ts';
import { getMessageKeyManifestEntry } from '@/services/db/storedMessageKeyManifest.ts';

export async function encryptCommentWithMessageKey(
  commentText: string,
  messageId: string,
  _messageCorePayload: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey,
  senderSigningPrivateKey: CryptoKey,
): Promise<string> {
  const access = await resolveParentMessageAccess(messageId, recipientKeyId);
  if (!access) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return encryptCommentWithAccess(
    commentText,
    messageId,
    access,
    recipientKeyId,
    recipientPrivateKey,
    senderPublicKey,
    senderSigningPrivateKey,
    (id, keyId) => getMessageKeyManifestEntry(id, keyId),
  );
}

export async function decryptComment(
  payloadJson: string,
  messageId: string,
  _messageCorePayload: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<string> {
  const access = await resolveParentMessageAccess(messageId, recipientKeyId);
  if (!access) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return decryptCommentWithAccess(
    payloadJson,
    messageId,
    access,
    recipientKeyId,
    recipientPrivateKey,
    (id, keyId) => getMessageKeyManifestEntry(id, keyId),
  );
}
