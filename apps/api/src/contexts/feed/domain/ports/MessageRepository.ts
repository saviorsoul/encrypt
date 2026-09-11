import type { StoredMessage } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import type { PrismaTx } from '@/lib/prisma.js';

export interface MessageRepository {
  getById(id: string): Promise<StoredMessage | null>;
  exists(id: string): Promise<boolean>;
  createWithManifestShards(
    id: string,
    payload: string,
    keyManifest: KeyManifestMap,
    senderKeyId: string,
  ): Promise<StoredMessage>;
  touchLastCommentAt(messageId: string, at: Date, tx?: PrismaTx): Promise<void>;
}
