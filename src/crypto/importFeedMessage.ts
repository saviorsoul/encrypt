import { getCommentThreadMessageId } from '@/crypto/manifestShare.ts';
import { verifyManifestShareSignature } from '@/crypto/manifestShare.ts';
import { parseManifestPayload } from '@/crypto/manifestDecrypt.ts';
import { parseManifestCorePayload } from '@/crypto/manifestStorage.ts';
import { verifyManifestSignature } from '@/crypto/manifestSign.ts';
import type { ParsedImportPayload } from '@/utils/parseImportPayloadText.ts';
import {
  encryptedMessageFingerprintFromPayloadJson,
  encryptedMessageFingerprintsMatch,
} from '@/types/oneToOne.ts';
import {
  getStoredMessageById,
  listStoredMessagesForRecipientKeyId,
  saveStoredMessage,
  saveStoredMessageCoreWithId,
  saveStoredShare,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';

export async function importParsedFeedMessage(
  payload: ParsedImportPayload,
  recipientKeyId: string,
): Promise<StoredMessage> {
  if (payload.kind === 'original') {
    const manifest = parseManifestPayload(payload.fullPayloadJson);
    await verifyManifestSignature(manifest);
    return saveStoredMessage(payload.fullPayloadJson);
  }

  if (
    await recipientAlreadyHasSharedMessageContent(
      payload.parentCorePayloadJson,
      recipientKeyId,
    )
  ) {
    throw new Error('You already have access to this message in your feed.');
  }

  await verifyManifestShareSignature(payload.shareWire);

  const parentCore = parseManifestCorePayload(payload.parentCorePayloadJson);
  await verifyManifestSignature(parentCore);

  const parentMessageId = crypto.randomUUID();
  const shareCoreJson = JSON.stringify({
    ...payload.shareWire,
    parentMessageId,
  });

  await saveStoredMessageCoreWithId(
    parentMessageId,
    payload.parentCorePayloadJson,
  );

  return saveStoredShare(shareCoreJson, payload.keyManifest, parentMessageId);
}

async function recipientAlreadyHasSharedMessageContent(
  parentCorePayloadJson: string,
  recipientKeyId: string,
): Promise<boolean> {
  const fingerprint = encryptedMessageFingerprintFromPayloadJson(
    parentCorePayloadJson,
  );
  if (fingerprint === null) {
    return false;
  }

  const messages = await listStoredMessagesForRecipientKeyId(recipientKeyId);
  for (const message of messages) {
    const threadId = getCommentThreadMessageId(message);
    const parent = await getStoredMessageById(threadId);
    if (!parent) {
      continue;
    }

    const existing = encryptedMessageFingerprintFromPayloadJson(parent.payload);
    if (
      existing !== null &&
      encryptedMessageFingerprintsMatch(existing, fingerprint)
    ) {
      return true;
    }
  }

  return false;
}
