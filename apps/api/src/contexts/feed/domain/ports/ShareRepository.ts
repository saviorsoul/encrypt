import type { StoredShare } from '@encrypt/core/feed/types';
import type { KeyManifestMap } from '@encrypt/core/types/manifest';

export type CreateShareWriteInput = {
  shareId: string;
  threadRootId: string;
  shareCoreJson: string;
  keyManifest: KeyManifestMap;
  parentMessage?: unknown;
  messageId?: string;
};

export interface ShareRepository {
  getById(id: string): Promise<StoredShare | null>;
  createShareWithAccess(input: CreateShareWriteInput): Promise<void>;
}
