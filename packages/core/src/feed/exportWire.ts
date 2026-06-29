import type { KeyManifestMap } from '../types/manifest.ts';
import { parseManifestShareCorePayload } from '../crypto/manifestShare.ts';

export function assembleShareExportPayloadJson(
  shareCoreJson: string,
  keyManifest: KeyManifestMap,
): string {
  const share = parseManifestShareCorePayload(shareCoreJson);

  return JSON.stringify({
    share,
    keyManifest,
  });
}

export function shareExportFilename(): string {
  return `shared-message-${crypto.randomUUID().slice(0, 8)}.json`;
}
