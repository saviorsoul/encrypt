import type {
  KeyManifestMap,
  KeyManifestRecipientPayload,
  ManifestCorePayload,
  ManifestPayload,
} from '../types/manifest.ts';
import {
  isManifestCorePayload,
  parseManifestPayload,
  validateManifestPayload,
} from '../crypto/manifestDecrypt.ts';
import { parseBaseJsonObjectOrThrow } from '../utils/validateBaseJsonText.ts';

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

/** Accepts stored core JSON or a full inline manifest; returns core JSON. */
export function manifestCorePayloadJsonFromWire(payloadJson: string): string {
  const parsed = parseBaseJsonObjectOrThrow(payloadJson);
  if (isManifestCorePayload(parsed)) {
    return payloadJson;
  }
  return splitManifestForStorage(payloadJson).corePayloadJson;
}

export function parseManifestCorePayload(
  payloadJson: string,
): ManifestCorePayload {
  const parsed = parseBaseJsonObjectOrThrow(payloadJson);
  if (!isManifestCorePayload(parsed)) {
    throw new Error(
      validateManifestPayload(parsed) ?? 'Invalid manifest core payload.',
    );
  }
  return parsed;
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
  return JSON.stringify(payload);
}
