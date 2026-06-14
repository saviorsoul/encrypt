import { getCommentThreadMessageId } from '@/crypto/manifestShare.ts';
import { verifyManifestShareSignature } from '@/crypto/manifestShare.ts';
import { parseManifestCorePayload } from '@/crypto/manifestStorage.ts';
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

  const parentMessageId = crypto.randomUUID();
  const shareCoreJson = JSON.stringify({
    ...payload.shareWire,
    parentMessageId,
  });

  parseManifestCorePayload(payload.parentCorePayloadJson);
  await saveStoredMessageCoreWithId(
    parentMessageId,
    payload.parentCorePayloadJson,
  );

  return saveStoredShare(
    shareCoreJson,
    payload.keyManifest,
    parentMessageId,
  );
}

async function recipientAlreadyHasSharedMessageContent(
  parentCorePayloadJson: string,
  recipientKeyId: string,
): Promise<boolean> {
  const fingerprint =
    encryptedMessageFingerprintFromPayloadJson(parentCorePayloadJson);
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
