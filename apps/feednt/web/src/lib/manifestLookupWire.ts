import type { FeedLabBridgeManifestLookupWire } from '@encrypt/core/feed/feedLabBridgeClientCrypto';
import type { KeyManifestLookup } from '@encrypt/core/feed/access';

export async function serializeManifestLookup(
  manifestLookup: KeyManifestLookup,
  messageIds: string[],
  recipientKeyIds: string[],
): Promise<FeedLabBridgeManifestLookupWire> {
  const wire: FeedLabBridgeManifestLookupWire = {};
  for (const messageId of messageIds) {
    for (const recipientKeyId of recipientKeyIds) {
      const entry = await Promise.resolve(
        manifestLookup(messageId, recipientKeyId),
      );
      if (entry) {
        if (!wire[messageId]) {
          wire[messageId] = {};
        }
        wire[messageId][recipientKeyId] = entry;
      }
    }
  }
  return wire;
}

export function collectManifestMessageIds(
  ...ids: Array<string | null | undefined>
): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
