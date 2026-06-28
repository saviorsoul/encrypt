import { COMMENT_VERSION, COMMENT_WRAP } from '@/crypto/commentConstants.ts';
import { validateCommentPayload } from '@/crypto/commentCrypto.ts';
import type { CommentPayload } from '@/types/comment.ts';
import type { ParseCommentImportPayloadResult } from '@/types/comment.ts';
import { parseJsonObjectText } from '@/utils/parseManifestPayloadText.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCommentPayloadShape(value: unknown): value is CommentPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.wrap === COMMENT_WRAP &&
    value.version === COMMENT_VERSION &&
    typeof value.messageId === 'string' &&
    Boolean(value.messageId)
  );
}

export function parseCommentImportPayloadText(
  text: string,
): ParseCommentImportPayloadResult {
  const json = parseJsonObjectText(text);
  if (json.ok === false) {
    return json;
  }

  if (!isCommentPayloadShape(json.parsed)) {
    return {
      ok: false,
      error:
        'Unrecognized comment import JSON. Expected a signed comment payload.',
    };
  }

  const commentError = validateCommentPayload(json.parsed);
  if (commentError) {
    return { ok: false, error: commentError };
  }

  return {
    ok: true,
    payload: json.parsed,
  };
}
