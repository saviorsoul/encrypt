import { isShareDelivery } from '@encrypt/core/crypto/manifestShare';
import { assembleShareCopyPayloadJson } from '@encrypt/core/feed/exportWire';
import { assembleManifestWithKeyManifest } from '@encrypt/core/crypto/manifestStorage';
import type {
  StoredComment,
  StoredFeedDelivery,
  StoredMessage,
} from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { getCachedKeyManifest } from '@lab/hooks/useBackendFeedData.ts';

export function assembleMessageCopyPayloadFromWire(
  messageId: string,
  wireBody: Record<string, unknown>,
): string {
  return JSON.stringify({ messageId, ...wireBody });
}

function assembleCommentCopyEntries(comments: StoredComment[]) {
  return comments.map((comment) => ({
    id: comment.id,
    createdAt: comment.createdAt,
    payload: JSON.parse(comment.payload) as Record<string, unknown>,
  }));
}

function hasKeyManifest(
  keyManifest: KeyManifestMap | null | undefined,
): keyManifest is KeyManifestMap {
  return Boolean(keyManifest && Object.keys(keyManifest).length > 0);
}

function findAccessibleShareDelivery(
  parentMessageId: string,
  allDeliveries: StoredFeedDelivery[],
): StoredFeedDelivery | null {
  for (const delivery of allDeliveries) {
    if (!isShareDelivery(delivery) || delivery.messageId !== parentMessageId) {
      continue;
    }
    if (hasKeyManifest(getCachedKeyManifest(delivery.id))) {
      return delivery;
    }
  }
  return null;
}

export function assembleStoredMessageCopyPayload(
  message: StoredMessage,
  comments: StoredComment[] = [],
  allDeliveries: StoredFeedDelivery[] = [],
): string {
  const commentEntries = assembleCommentCopyEntries(comments);
  const directKeyManifest = getCachedKeyManifest(message.id);

  if (hasKeyManifest(directKeyManifest)) {
    const manifestJson = assembleManifestWithKeyManifest(
      message.payload,
      directKeyManifest,
    );
    const manifest = JSON.parse(manifestJson) as Record<string, unknown>;
    return JSON.stringify({
      messageId: message.id,
      ...manifest,
      comments: commentEntries,
    });
  }

  const shareDelivery = findAccessibleShareDelivery(message.id, allDeliveries);
  if (shareDelivery && isShareDelivery(shareDelivery)) {
    const shareKeyManifest = getCachedKeyManifest(shareDelivery.id);
    if (!hasKeyManifest(shareKeyManifest)) {
      throw new Error(
        'Key manifest not loaded for this share. Reload the feed and try again.',
      );
    }

    return assembleShareCopyPayloadJson({
      messageId: shareDelivery.id,
      shareCoreJson: shareDelivery.payload,
      keyManifest: shareKeyManifest,
      parentCoreJson: message.payload,
      comments: commentEntries,
    });
  }

  throw new Error(
    'Key manifest not loaded for this message. Reload the feed and try again.',
  );
}
