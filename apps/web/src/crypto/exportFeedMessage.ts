import type { KeyManifestMap } from '@/types/manifest.ts';
import { isShareDelivery } from '@/crypto/manifestShare.ts';
import { assembleManifestWithKeyManifest } from '@/crypto/manifestStorage.ts';
import { parseManifestShareCorePayload } from '@/crypto/manifestShare.ts';
import { getKeyManifestForMessage } from '@/services/db/storedMessageKeyManifest.ts';
import type { StoredFeedDelivery } from '@/services/db/storedMessages.ts';

export function assembleShareExportPayloadJson(
  shareCoreJson: string,
  keyManifest: KeyManifestMap,
): string {
  const share = parseManifestShareCorePayload(shareCoreJson);

  return JSON.stringify({
    share,
    keyManifest,
  });
}

export function shareExportFilename(): string {
  return `shared-message-${crypto.randomUUID().slice(0, 8)}.json`;
}

export async function assembleStoredFeedMessageCopyPayload(
  message: StoredFeedDelivery,
): Promise<string> {
  const keyManifest = await getKeyManifestForMessage(message.id);

  if (isShareDelivery(message)) {
    return assembleShareExportPayloadJson(message.payload, keyManifest);
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
