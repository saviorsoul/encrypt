import { isShareDelivery } from '@/crypto/manifestShare.ts';
import {
  assembleShareExportPayloadJson,
  shareExportFilename,
} from '@encrypt/core/feed/exportWire';
import { assembleManifestWithKeyManifest } from '@/crypto/manifestStorage.ts';
import { getKeyManifestForMessage } from '@/services/db/storedMessageKeyManifest.ts';
import type { StoredFeedDelivery } from '@/services/db/storedMessages.ts';

export { assembleShareExportPayloadJson, shareExportFilename };

export async function assembleStoredFeedMessageCopyPayload(
  message: StoredFeedDelivery,
): Promise<string> {
  const keyManifest = await getKeyManifestForMessage(message.id);

  if (isShareDelivery(message)) {
    return JSON.stringify({
      messageId: message.id,
      share: JSON.parse(message.payload),
      keyManifest,
    });
  }

  const manifestJson = assembleManifestWithKeyManifest(
    message.payload,
    keyManifest,
  );
  const manifest = JSON.parse(manifestJson) as Record<string, unknown>;
  return JSON.stringify({
    messageId: message.id,
    ...manifest,
  });
}
