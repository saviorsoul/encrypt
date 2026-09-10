import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { badRequest } from '@/lib/httpError.js';

/**
 * Require the sender in the POST keyManifest, then keep the sender plus
 * keyIds that are friends in the DB. Extra POST recipients (and former
 * friends) are omitted — no shard; the request still succeeds.
 */
export function filterKeyManifestToFriends(
  keyManifest: KeyManifestMap,
  senderKeyId: string,
  friendKeyIds: Set<string>,
): KeyManifestMap {
  if (!(senderKeyId in keyManifest)) {
    throw badRequest('keyManifest must include the sender.');
  }

  const kept: KeyManifestMap = {};

  for (const keyId of Object.keys(keyManifest)) {
    if (keyId === senderKeyId || friendKeyIds.has(keyId)) {
      kept[keyId] = keyManifest[keyId]!;
    }
  }

  if (Object.keys(kept).length === 0) {
    throw badRequest('keyManifest has no active recipients.');
  }

  return kept;
}
