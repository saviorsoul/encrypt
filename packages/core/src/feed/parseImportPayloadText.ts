import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '../constants/manifestShare.ts';
import { validateCommentPayload } from '../crypto/commentCrypto.ts';
import { validateManifestShareWirePayload } from '../crypto/manifestShare.ts';
import type { CommentPayload } from '../types/comment.ts';
import type { KeyManifestMap } from '../types/manifest.ts';
import type { ManifestShareWirePayload } from '../types/manifestShare.ts';
import {
  manifestCorePayloadJsonFromWire,
  parseManifestCorePayload,
} from '../crypto/manifestStorage.ts';
import {
  parseJsonObjectText,
  parseManifestPayloadText,
} from '../utils/parseManifestPayloadText.ts';

export type ParsedBundledCommentImport = {
  id: string;
  createdAt: number;
  payload: CommentPayload;
};

export type ParsedOriginalImportPayload = {
  kind: 'original';
  fullPayloadJson: string;
  keyManifest: KeyManifestMap;
  /** Present when the export included a local IndexedDB message id. */
  exportedMessageId?: string;
  comments?: ParsedBundledCommentImport[];
};

export type ParsedShareImportPayload = {
  kind: 'share';
  share: ManifestShareWirePayload;
  keyManifest: KeyManifestMap;
  parentMessageId: string;
  parentMessageJson: string;
  /** Share delivery row id when the export included one. */
  messageId?: string;
  comments?: ParsedBundledCommentImport[];
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
    parentMessage: isRecord(parsed.parentMessage)
      ? parsed.parentMessage
      : undefined,
    comments: parsed.comments,
  };
}

type ShareImport = {
  share: ManifestShareWirePayload;
  keyManifest?: KeyManifestMap;
  messageId?: string;
  parentMessage?: Record<string, unknown>;
  comments?: unknown;
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

  if (!wire.parentMessage) {
    return {
      ok: false,
      error: 'Share import is missing parentMessage.',
    };
  }

  let parentMessageJson: string;
  try {
    parentMessageJson = manifestCorePayloadJsonFromWire(
      JSON.stringify(wire.parentMessage),
    );
    parseManifestCorePayload(parentMessageJson);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid parentMessage.',
    };
  }

  const commentsResult = parseBundledComments(
    wire.comments,
    share.parentMessageId,
  );
  if (commentsResult.ok === false) {
    return commentsResult;
  }

  return {
    ok: true,
    payload: {
      kind: 'share',
      share,
      keyManifest,
      parentMessageId: share.parentMessageId,
      parentMessageJson,
      messageId: wire.messageId,
      comments:
        commentsResult.comments.length > 0
          ? commentsResult.comments
          : undefined,
    },
  };
}

type ParseBundledCommentsResult =
  | { ok: true; comments: ParsedBundledCommentImport[] }
  | { ok: false; error: string };

type ParsedBundledCommentEntry =
  | { comment: ParsedBundledCommentImport }
  | { error: string };

function bundledCommentEntryError(
  index: number,
  detail: string,
): { error: string } {
  return { error: `comments[${index}]${detail}` };
}

function parseBundledCommentEntry(
  entry: unknown,
  index: number,
  parentMessageId: string | undefined,
): ParsedBundledCommentEntry {
  if (!isRecord(entry)) {
    return bundledCommentEntryError(index, ' must be an object.');
  }

  if (typeof entry.id !== 'string' || !entry.id) {
    return bundledCommentEntryError(index, ' is missing id.');
  }

  if (
    typeof entry.createdAt !== 'number' ||
    !Number.isFinite(entry.createdAt)
  ) {
    return bundledCommentEntryError(index, ' is missing createdAt.');
  }

  if (!isRecord(entry.payload)) {
    return bundledCommentEntryError(index, ' is missing payload.');
  }

  const commentError = validateCommentPayload(
    entry.payload as unknown as CommentPayload,
  );
  if (commentError) {
    return bundledCommentEntryError(index, `: ${commentError}`);
  }

  const commentPayload = entry.payload as unknown as CommentPayload;
  if (
    parentMessageId !== undefined &&
    commentPayload.messageId !== parentMessageId
  ) {
    return bundledCommentEntryError(
      index,
      ` references messageId ${commentPayload.messageId}, expected ${parentMessageId}.`,
    );
  }

  return {
    comment: {
      id: entry.id,
      createdAt: entry.createdAt,
      payload: commentPayload,
    },
  };
}

function parseBundledComments(
  value: unknown,
  parentMessageId: string | undefined,
): ParseBundledCommentsResult {
  if (value === undefined) {
    return { ok: true, comments: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: 'comments must be an array when present.' };
  }

  const comments: ParsedBundledCommentImport[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const parsedEntry = parseBundledCommentEntry(
      value[index],
      index,
      parentMessageId,
    );
    if ('error' in parsedEntry) {
      return { ok: false, error: parsedEntry.error };
    }
    comments.push(parsedEntry.comment);
  }

  return { ok: true, comments };
}

function parseOriginalImportPayload(text: string): ParseImportPayloadResult {
  const json = parseJsonObjectText(text);
  if (json.ok === false) {
    return json;
  }

  const { messageId, comments: commentsWire, ...manifestRecord } = json.parsed;
  const exportedMessageId =
    typeof messageId === 'string' ? messageId : undefined;

  const commentsResult = parseBundledComments(commentsWire, exportedMessageId);
  if (commentsResult.ok === false) {
    return commentsResult;
  }

  if (commentsResult.comments.length > 0 && !exportedMessageId) {
    return {
      ok: false,
      error: 'Bundled comment imports require messageId at the top level.',
    };
  }

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
      comments:
        commentsResult.comments.length > 0
          ? commentsResult.comments
          : undefined,
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
