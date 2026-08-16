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

export type CreateShareWriteResult =
  | { created: true }
  | { created: false; reason: 'recipients_already_had_access' };

export interface ShareRepository {
  getById(id: string): Promise<StoredShare | null>;
  createShareWithAccess(
    input: CreateShareWriteInput,
  ): Promise<CreateShareWriteResult>;
}
