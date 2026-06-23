import type { KeyManifestMap } from '@/types/manifest.ts';
import { isShareDelivery } from '@/crypto/manifestShare.ts';
import {
  assembleManifestWithKeyManifest,
  parseManifestCorePayload,
} from '@/crypto/manifestStorage.ts';
import {
  parseManifestShareCorePayload,
  shareCoreToWirePayload,
} from '@/crypto/manifestShare.ts';
import { getKeyManifestForMessage } from '@/services/db/storedMessageKeyManifest.ts';
import {
  getStoredMessageById,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';

export function assembleShareExportPayloadJson(
  shareCoreJson: string,
  keyManifest: KeyManifestMap,
  parentCorePayloadJson: string,
): string {
  const shareCore = parseManifestShareCorePayload(shareCoreJson);
  const originalMessage = parseManifestCorePayload(parentCorePayloadJson);

  return JSON.stringify({
    originalMessage,
    share: shareCoreToWirePayload(shareCore),
    keyManifest,
  });
}

export function shareExportFilename(): string {
  return `shared-message-${crypto.randomUUID().slice(0, 8)}.json`;
}

export async function assembleStoredFeedMessageCopyPayload(
  message: StoredMessage,
): Promise<string> {
  const keyManifest = await getKeyManifestForMessage(message.id);

  if (isShareDelivery(message)) {
    const parentMessageId = message.parentMessageId;
    if (!parentMessageId) {
      throw new Error('Share delivery is missing parentMessageId.');
    }

    const parentMessage = await getStoredMessageById(parentMessageId);
    if (!parentMessage) {
      throw new Error('Parent message not found.');
    }

    return assembleShareExportPayloadJson(
      message.payload,
      keyManifest,
      parentMessage.payload,
    );
  }

  return assembleManifestWithKeyManifest(message.payload, keyManifest);
}
