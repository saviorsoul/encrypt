import {
  recipientHasAccessToParentMessage,
  verifyManifestShareSignature,
} from '@/crypto/manifestShare.ts';
import type { ParsedImportPayload } from '@/utils/parseImportPayloadText.ts';
import {
  getStoredMessageById,
  saveStoredMessage,
  saveStoredMessageWithId,
  saveStoredShare,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';
import { parseManifestPayload } from '@/crypto/manifestDecrypt.ts';
import { verifyManifestSignature } from '@/crypto/manifestSign.ts';

export async function importParsedFeedMessage(
  payload: ParsedImportPayload,
  recipientKeyId: string,
): Promise<StoredMessage> {
  if (payload.kind === 'original') {
    const manifest = parseManifestPayload(payload.fullPayloadJson);
    await verifyManifestSignature(manifest);
    if (payload.exportedMessageId) {
      const existing = await getStoredMessageById(payload.exportedMessageId);
      if (existing) {
        throw new Error('This message is already in your feed.');
      }
      return saveStoredMessageWithId(
        payload.exportedMessageId,
        payload.fullPayloadJson,
      );
    }
    return saveStoredMessage(payload.fullPayloadJson);
  }

  await verifyManifestShareSignature(payload.shareWire);

  const parentMessage = await getStoredMessageById(payload.parentMessageId);
  if (!parentMessage) {
    throw new Error('Parent message not found.');
  }

  if (
    await recipientHasAccessToParentMessage(
      payload.parentMessageId,
      recipientKeyId,
    )
  ) {
    throw new Error('You already have access to this message in your feed.');
  }

  const shareCoreJson = JSON.stringify(payload.shareWire);

  return saveStoredShare(
    shareCoreJson,
    payload.keyManifest,
    payload.parentMessageId,
  );
}
