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

export function assembleShareCopyPayloadJson(options: {
  messageId: string;
  shareCoreJson: string;
  keyManifest: KeyManifestMap;
  parentCoreJson: string;
  comments?: unknown[];
}): string {
  const payload: Record<string, unknown> = {
    messageId: options.messageId,
    share: JSON.parse(options.shareCoreJson) as Record<string, unknown>,
    keyManifest: options.keyManifest,
    parentMessage: JSON.parse(options.parentCoreJson) as Record<
      string,
      unknown
    >,
  };

  if (options.comments !== undefined) {
    payload.comments = options.comments;
  }

  return JSON.stringify(payload);
}

export function shareExportFilename(): string {
  return `shared-message-${crypto.randomUUID().slice(0, 8)}.json`;
}
