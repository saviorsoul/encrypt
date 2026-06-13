import type { KeyManifestMap } from '@/types/manifest.ts';
import { parseManifestCorePayload } from '@/crypto/manifestStorage.ts';
import {
  parseManifestShareCorePayload,
  shareCoreToWirePayload,
} from '@/crypto/manifestShare.ts';

export function assembleShareExportPayloadJson(
  shareCoreJson: string,
  keyManifest: KeyManifestMap,
  parentCorePayloadJson: string,
): string {
  const shareCore = parseManifestShareCorePayload(shareCoreJson);
  const originalMessage = parseManifestCorePayload(parentCorePayloadJson);

  return JSON.stringify(
    {
      originalMessage,
      share: shareCoreToWirePayload(shareCore),
      keyManifest,
    },
    null,
    2,
  );
}

export function shareExportFilename(): string {
  return `shared-message-${crypto.randomUUID().slice(0, 8)}.json`;
}
