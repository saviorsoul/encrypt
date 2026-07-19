import type { KeyManifestMap } from '@encrypt/core/types/manifest';

export interface ManifestShardRepository {
  listDeliveryIdsForRecipientKeyId(recipientKeyId: string): Promise<string[]>;
  getManifestEntry(
    parentMessageId: string,
    recipientKeyId: string,
  ): Promise<KeyManifestMap[string] | null>;
  getManifestEntryForDelivery(
    deliveryId: string,
    recipientKeyId: string,
  ): Promise<KeyManifestMap[string] | null>;
}
