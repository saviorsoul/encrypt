import { importPrivateKeyForEcdsaSign } from '@/crypto/ecdsaKeys.ts';
import { encryptWithManifest } from '@/crypto/manifestEncrypt.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { readPrivateKeyJwkFromText } from '@/crypto/privateKeyFile.ts';
import {
  loadPublicKeyFromStored,
  loadRecipientKeysForUsername,
} from '@/services/db/storedPublicKeys.ts';
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
  privateKeyText: string,
): Promise<TrayEncryptCopiedMessageResult> {
  const recipient = await loadRecipientKeysForUsername(recipientUsername);
  if (!recipient) {
    throw new Error(`No public key found for ${recipientUsername}.`);
  }

  const privateJwk = readPrivateKeyJwkFromText(privateKeyText);
  const senderPublicJwk = slimEcPublicJwk(privateJwk);
  const senderKeyId = await ecPublicJwkThumbprintSha256(senderPublicJwk);
  const { publicKey: senderPublicKey } =
    await loadPublicKeyFromStored(senderPublicJwk);
  const senderSigningPrivateKey =
    await importPrivateKeyForEcdsaSign(privateJwk);

  const payload = await encryptWithManifest(
    plaintext,
    [recipient],
    senderPublicKey,
    senderSigningPrivateKey,
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
