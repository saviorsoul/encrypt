import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '../constants/manifestShare.ts';
import { validateManifestShareWirePayload } from '../crypto/manifestShare.ts';
import type { KeyManifestMap } from '../types/manifest.ts';
import type { ManifestShareWirePayload } from '../types/manifestShare.ts';
import {
  parseJsonObjectText,
  parseManifestPayloadText,
} from '../utils/parseManifestPayloadText.ts';

export type ParsedOriginalImportPayload = {
  kind: 'original';
  fullPayloadJson: string;
  keyManifest: KeyManifestMap;
  /** Present when the export included a local IndexedDB message id. */
  exportedMessageId?: string;
};

export type ParsedShareImportPayload = {
  kind: 'share';
  share: ManifestShareWirePayload;
  keyManifest: KeyManifestMap;
  parentMessageId: string;
  /** Share delivery row id when the export included one. */
  messageId?: string;
};

export type ParsedImportPayload =
  | ParsedOriginalImportPayload
  | ParsedShareImportPayload;

export type ParseImportPayloadResult =
  | { ok: true; payload: ParsedImportPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseShareObject(
  value: Record<string, unknown>,
): ManifestShareWirePayload {
  return {
    version: value.version as number,
    wrap: value.wrap as ManifestShareWirePayload['wrap'],
    parentMessageId: value.parentMessageId as string,
    sharerPublicJwk: value.sharerPublicJwk as JsonWebKey,
    ephemeralPublicKey: value.ephemeralPublicKey as JsonWebKey,
    sharerSignature: value.sharerSignature as string,
  };
}

function normalizeShareImport(
  parsed: Record<string, unknown>,
): ShareImport | null {
  if (
    !isRecord(parsed.share) ||
    parsed.share.wrap !== MANIFEST_SHARE_WRAP ||
    parsed.share.version !== MANIFEST_SHARE_VERSION
  ) {
    return null;
  }

  return {
    share: parseShareObject(parsed.share),
    keyManifest: parsed.keyManifest as KeyManifestMap | undefined,
    messageId:
      typeof parsed.messageId === 'string' ? parsed.messageId : undefined,
  };
}

type ShareImport = {
  share: ManifestShareWirePayload;
  keyManifest?: KeyManifestMap;
  messageId?: string;
};

function parseShareImportPayload(wire: ShareImport): ParseImportPayloadResult {
  const share = wire.share;
  const shareError = validateManifestShareWirePayload(share);
  if (shareError) {
    return { ok: false, error: shareError };
  }

  const keyManifest = wire.keyManifest;
  if (!keyManifest || Object.keys(keyManifest).length === 0) {
    return {
      ok: false,
      error: 'Share payload has no keyManifest entries to store.',
    };
  }

  if (!share.parentMessageId) {
    return {
      ok: false,
      error: 'Share payload is missing parentMessageId.',
    };
  }

  return {
    ok: true,
    payload: {
      kind: 'share',
      share,
      keyManifest,
      parentMessageId: share.parentMessageId,
      messageId: wire.messageId,
    },
  };
}

function parseOriginalImportPayload(text: string): ParseImportPayloadResult {
  const json = parseJsonObjectText(text);
  if (json.ok === false) {
    return json;
  }

  const { messageId, ...manifestRecord } = json.parsed;
  const exportedMessageId =
    typeof messageId === 'string' ? messageId : undefined;
  const manifestText = JSON.stringify(manifestRecord);

  const manifestResult = parseManifestPayloadText(manifestText);
  if (manifestResult.ok === false) {
    return manifestResult;
  }

  const keyManifest = manifestResult.payload.keyManifest;
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
      fullPayloadJson: manifestText,
      keyManifest,
      exportedMessageId,
    },
  };
}

/** Parse and validate feed import JSON (original manifest or shared export). */
export function parseImportPayloadText(text: string): ParseImportPayloadResult {
  const json = parseJsonObjectText(text);
  if (json.ok === false) {
    return json;
  }

  const shareImport = normalizeShareImport(json.parsed);
  if (shareImport) {
    if (!shareImport.keyManifest) {
      return {
        ok: false,
        error: 'Share payload has no keyManifest entries to store.',
      };
    }
    return parseShareImportPayload(shareImport);
  }

  return parseOriginalImportPayload(text);
}

export function recipientKeyInImportPayload(
  payload: ParsedImportPayload,
  recipientKeyId: string,
): boolean {
  return recipientKeyId in payload.keyManifest;
}
