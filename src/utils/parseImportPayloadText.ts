import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '@/constants/manifestShare.ts';
import { validateManifestPayload } from '@/crypto/manifestDecrypt.ts';
import { validateManifestShareWirePayload } from '@/crypto/manifestShare.ts';
import type { KeyManifestMap, ManifestCorePayload } from '@/types/manifest.ts';
import type { ManifestPayload } from '@/types/manifest.ts';
import type { ManifestShareWirePayload } from '@/types/manifestShare.ts';
import {
  encryptedMessageFingerprintFromPayloadJson,
  type EncryptedMessageFingerprint,
} from '@/types/oneToOne.ts';

export type ParsedOriginalImportPayload = {
  kind: 'original';
  fullPayloadJson: string;
  keyManifest: KeyManifestMap;
};

export type ParsedShareImportPayload = {
  kind: 'share';
  shareWire: ManifestShareWirePayload;
  keyManifest: KeyManifestMap;
  parentCorePayloadJson: string;
};

export type ParsedImportPayload =
  | ParsedOriginalImportPayload
  | ParsedShareImportPayload;

export type ParseImportPayloadResult =
  | { ok: true; payload: ParsedImportPayload }
  | { ok: false; error: string };

type ShareImportWirePayload = ManifestShareWirePayload & {
  keyManifest?: KeyManifestMap;
  originalMessage?: ManifestCorePayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractShareWire(
  value: Record<string, unknown>,
): ManifestShareWirePayload {
  return {
    version: value.version as number,
    wrap: value.wrap as ManifestShareWirePayload['wrap'],
    sharerPublicJwk: value.sharerPublicJwk as JsonWebKey,
    ephemeralPublicKey: value.ephemeralPublicKey as JsonWebKey,
    sharerSignature: value.sharerSignature as string,
  };
}

function normalizeShareImportWire(
  parsed: Record<string, unknown>,
): ShareImportWirePayload | null {
  if (
    !isRecord(parsed.share) ||
    !isRecord(parsed.originalMessage) ||
    parsed.share.wrap !== MANIFEST_SHARE_WRAP ||
    parsed.share.version !== MANIFEST_SHARE_VERSION
  ) {
    return null;
  }

  return {
    ...extractShareWire(parsed.share),
    keyManifest: parsed.keyManifest as KeyManifestMap | undefined,
    originalMessage: parsed.originalMessage as ManifestCorePayload,
  };
}

function parseShareImportPayload(
  wire: ShareImportWirePayload,
): ParseImportPayloadResult {
  const shareWire = extractShareWire(wire);
  const shareWireError = validateManifestShareWirePayload(shareWire);
  if (shareWireError) {
    return { ok: false, error: shareWireError };
  }

  const keyManifest = wire.keyManifest;
  if (!keyManifest || Object.keys(keyManifest).length === 0) {
    return {
      ok: false,
      error: 'Share payload has no keyManifest entries to store.',
    };
  }

  if (!wire.originalMessage) {
    return {
      ok: false,
      error: 'Shared message export is missing embedded originalMessage.',
    };
  }

  const parentValidationError = validateManifestPayload(
    wire.originalMessage as ManifestPayload,
  );
  if (parentValidationError) {
    return {
      ok: false,
      error: `Invalid originalMessage in share export: ${parentValidationError}`,
    };
  }

  return {
    ok: true,
    payload: {
      kind: 'share',
      shareWire,
      keyManifest,
      parentCorePayloadJson: JSON.stringify(wire.originalMessage),
    },
  };
}

function parseOriginalImportPayload(
  parsed: Record<string, unknown>,
  text: string,
): ParseImportPayloadResult {
  const validationError = validateManifestPayload(
    parsed as unknown as ManifestPayload,
  );
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const payload = parsed as unknown as ManifestPayload;
  const keyManifest = payload.keyManifest;
  if (!keyManifest || Object.keys(keyManifest).length === 0) {
    return {
      ok: false,
      error: 'Manifest has no keyManifest entries to store.',
    };
  }

  return {
    ok: true,
    payload: {
      kind: 'original',
      fullPayloadJson: text,
      keyManifest,
    },
  };
}

/** Parse and validate feed import JSON (original manifest or shared export). */
export function parseImportPayloadText(text: string): ParseImportPayloadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  const shareWire = normalizeShareImportWire(parsed);
  if (shareWire) {
    return parseShareImportPayload(shareWire);
  }

  return parseOriginalImportPayload(parsed, text);
}

export function recipientKeyInImportPayload(
  payload: ParsedImportPayload,
  recipientKeyId: string,
): boolean {
  return recipientKeyId in payload.keyManifest;
}

export function shareImportContentFingerprint(
  payload: ParsedShareImportPayload,
): EncryptedMessageFingerprint | null {
  return encryptedMessageFingerprintFromPayloadJson(
    payload.parentCorePayloadJson,
  );
}
