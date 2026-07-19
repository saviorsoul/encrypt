import type { StoredMessage } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';

export interface MessageRepository {
  getById(id: string): Promise<StoredMessage | null>;
  exists(id: string): Promise<boolean>;
  createWithManifestShards(
    id: string,
    payload: string,
    keyManifest: KeyManifestMap,
  ): Promise<StoredMessage>;
}
