export * from '@encrypt/core/crypto/manifestDecrypt';

import {
  decryptMessageDekFromCore,
  assembleStoredMessagePayloadFromEntry,
} from '@encrypt/core/crypto/manifestDecrypt';
import { getMessageKeyManifestEntry } from '@/services/db/storedMessageKeyManifest.ts';

export async function decryptStoredMessageDek(
  messageId: string,
  messageCorePayload: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<ArrayBuffer> {
  const entry = await getMessageKeyManifestEntry(messageId, recipientKeyId);
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return decryptMessageDekFromCore(
    messageCorePayload,
    entry,
    recipientPrivateKey,
  );
}

export async function assembleStoredMessagePayload(
  messageId: string,
  corePayloadJson: string,
  recipientKeyId: string,
): Promise<string> {
  const entry = await getMessageKeyManifestEntry(messageId, recipientKeyId);
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return assembleStoredMessagePayloadFromEntry(
    corePayloadJson,
    recipientKeyId,
    entry,
  );
}
