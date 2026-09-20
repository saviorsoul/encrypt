import { isShareDelivery } from '@/crypto/manifestShare.ts';
import {
  assembleShareCopyPayloadJson,
  assembleShareExportPayloadJson,
  shareExportFilename,
} from '@encrypt/core/feed/exportWire';
import { assembleManifestWithKeyManifest } from '@/crypto/manifestStorage.ts';
import { getKeyManifestForMessage } from '@/services/db/storedMessageKeyManifest.ts';
import {
  getStoredMessageById,
  type StoredFeedDelivery,
} from '@/services/db/storedMessages.ts';
import {
  listShareDeliveriesForMessage,
  type StoredShare,
} from '@/services/db/storedShares.ts';
import type { KeyManifestMap } from '@/types/manifest.ts';

export {
  assembleShareCopyPayloadJson,
  assembleShareExportPayloadJson,
  shareExportFilename,
};

function hasKeyManifest(
  keyManifest: KeyManifestMap | null | undefined,
): keyManifest is KeyManifestMap {
  return Boolean(keyManifest && Object.keys(keyManifest).length > 0);
}

async function loadKeyManifestIfPresent(
  messageId: string,
): Promise<KeyManifestMap | null> {
  try {
    const keyManifest = await getKeyManifestForMessage(messageId);
    return hasKeyManifest(keyManifest) ? keyManifest : null;
  } catch {
    return null;
  }
}

async function findAccessibleShareDelivery(
  parentMessageId: string,
): Promise<{ share: StoredShare; keyManifest: KeyManifestMap } | null> {
  const shares = await listShareDeliveriesForMessage(parentMessageId);
  for (const share of shares) {
    const keyManifest = await loadKeyManifestIfPresent(share.id);
    if (keyManifest) {
      return { share, keyManifest };
    }
  }
  return null;
}

export async function assembleStoredFeedMessageCopyPayload(
  message: StoredFeedDelivery,
): Promise<string> {
  if (isShareDelivery(message)) {
    const keyManifest = await loadKeyManifestIfPresent(message.id);
    if (!keyManifest) {
      throw new Error(
        'Key manifest not loaded for this share. Reload the feed and try again.',
      );
    }

    const parentMessage = await getStoredMessageById(message.messageId);
    if (!parentMessage) {
      throw new Error('Parent message not found.');
    }

    return assembleShareCopyPayloadJson({
      messageId: message.id,
      shareCoreJson: message.payload,
      keyManifest,
      parentCoreJson: parentMessage.payload,
    });
  }

  const directKeyManifest = await loadKeyManifestIfPresent(message.id);
  if (directKeyManifest) {
    const manifestJson = assembleManifestWithKeyManifest(
      message.payload,
      directKeyManifest,
    );
    const manifest = JSON.parse(manifestJson) as Record<string, unknown>;
    return JSON.stringify({
      messageId: message.id,
      ...manifest,
    });
  }

  const accessibleShare = await findAccessibleShareDelivery(message.id);
  if (accessibleShare) {
    return assembleShareCopyPayloadJson({
      messageId: accessibleShare.share.id,
      shareCoreJson: accessibleShare.share.payload,
      keyManifest: accessibleShare.keyManifest,
      parentCoreJson: message.payload,
    });
  }

  throw new Error(
    'Key manifest not loaded for this message. Reload the feed and try again.',
  );
}
