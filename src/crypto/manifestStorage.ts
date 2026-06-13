import type {
  KeyManifestMap,
  KeyManifestRecipientPayload,
  ManifestCorePayload,
  ManifestPayload,
} from '@/types/manifest.ts';
import {
  parseManifestPayload,
  validateManifestPayload,
} from '@/crypto/manifestDecrypt.ts';

export function splitManifestForStorage(fullPayloadJson: string): {
  corePayloadJson: string;
  keyManifest: KeyManifestMap;
} {
  const full = parseManifestPayload(fullPayloadJson);
  const { keyManifest, ...core } = full;
  if (!keyManifest || Object.keys(keyManifest).length === 0) {
    throw new Error('Manifest has no keyManifest entries to store.');
  }
  return {
    corePayloadJson: JSON.stringify(core),
    keyManifest,
  };
}

export function parseManifestCorePayload(
  payloadJson: string,
): ManifestCorePayload {
  let payload: ManifestCorePayload;
  try {
    payload = JSON.parse(payloadJson) as ManifestCorePayload;
  } catch {
    throw new Error('Invalid JSON.');
  }
  const validationError = validateManifestPayload(payload as ManifestPayload);
  if (validationError) {
    throw new Error(validationError);
  }
  return payload;
}

export function assembleManifestForRecipient(
  corePayloadJson: string,
  recipientKeyId: string,
  entry: KeyManifestRecipientPayload,
): string {
  const core = parseManifestCorePayload(corePayloadJson);
  const payload: ManifestPayload = {
    ...core,
    keyManifest: { [recipientKeyId]: entry },
  };
  return JSON.stringify(payload);
}

export function assembleManifestWithKeyManifest(
  corePayloadJson: string,
  keyManifest: KeyManifestMap,
): string {
  if (Object.keys(keyManifest).length === 0) {
    throw new Error('Manifest has no keyManifest entries to assemble.');
  }

  const core = parseManifestCorePayload(corePayloadJson);
  const payload: ManifestPayload = {
    ...core,
    keyManifest,
  };
  return JSON.stringify(payload, null, 2);
}
