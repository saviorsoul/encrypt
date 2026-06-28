import { encryptWithManifest } from '@/crypto/manifestEncrypt.ts';
import type { UploadedPrivateKeyMaterial } from '@/crypto/privateKeyMaterial.ts';
import { loadRecipientKeysForUsername } from '@/services/db/storedPublicKeys.ts';
import {
  oneToOneThreadKey,
  saveOneToOneMessage,
} from '@/services/db/storedOneToOneMessages.ts';
import type { OneToOneThreadItem } from '@/types/oneToOne.ts';

export type TrayEncryptCopiedMessageResult = {
  payload: string;
  senderKeyId: string;
  recipientKeyId: string;
  plaintext: string;
  threadItem: OneToOneThreadItem;
};

export async function encryptCopiedMessageForRecipient(
  plaintext: string,
  recipientUsername: string,
  material: UploadedPrivateKeyMaterial,
  senderPublicKey: CryptoKey,
): Promise<TrayEncryptCopiedMessageResult> {
  const recipient = await loadRecipientKeysForUsername(recipientUsername);
  if (!recipient) {
    throw new Error(`No public key found for ${recipientUsername}.`);
  }

  const senderKeyId = material.keyId;

  const payload = await encryptWithManifest(
    plaintext,
    [recipient],
    senderPublicKey,
    material.ecdsaSignPrivateKey,
  );

  const encryptedAt = Date.now();
  const threadItem: OneToOneThreadItem = {
    id: crypto.randomUUID(),
    createdAt: encryptedAt,
    encryptedAt,
    side: 'sender',
    encryptedPayload: payload,
    text: plaintext,
    decryptedAt: encryptedAt,
  };

  return {
    payload,
    senderKeyId,
    recipientKeyId: recipient.keyId,
    plaintext,
    threadItem,
  };
}

export async function saveTrayEncryptToOneToOneThread(
  result: TrayEncryptCopiedMessageResult,
): Promise<OneToOneThreadItem> {
  const { threadItem, senderKeyId, recipientKeyId, payload } = result;

  await saveOneToOneMessage({
    id: threadItem.id,
    threadKey: oneToOneThreadKey(senderKeyId, recipientKeyId),
    senderKeyId,
    recipientKeyId,
    createdAt: threadItem.createdAt,
    encryptedAt: threadItem.encryptedAt,
    encryptedPayload: payload,
  });

  return threadItem;
}
