import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { badRequest } from '@/lib/httpError.js';

/**
 * Require the sender in the POST keyManifest, then keep the sender plus
 * keyIds that are friends in the DB. Extra POST recipients (and former
 * friends) are omitted — no shard; the request still succeeds.
 *
 * Recipients who muted the sender for this delivery kind are also omitted.
 * Existing shards are never changed.
 */
export function filterKeyManifestToFriends(
  keyManifest: KeyManifestMap,
  senderKeyId: string,
  friendKeyIds: Set<string>,
  recipientKeyIdsWhoMutedSender: Set<string> = new Set(),
): KeyManifestMap {
  if (!(senderKeyId in keyManifest)) {
    throw badRequest('keyManifest must include the sender.');
  }

  const kept: KeyManifestMap = {
    [senderKeyId]: keyManifest[senderKeyId],
  };

  for (const friendKeyId of friendKeyIds) {
    if (friendKeyId === senderKeyId) {
      continue;
    }
    if (recipientKeyIdsWhoMutedSender.has(friendKeyId)) {
      continue;
    }
    const entry = keyManifest[friendKeyId];
    if (entry !== undefined) {
      kept[friendKeyId] = entry;
    }
  }

  if (Object.keys(kept).length === 0) {
    throw badRequest('keyManifest has no active recipients.');
  }

  return kept;
}
