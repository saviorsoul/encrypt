import { COMMENT_WRAP } from '@encrypt/core/crypto/commentConstants';
import type { FeedApi } from '@encrypt/core/api/feedApi';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ImportPath = '/api/messages' | '/api/shares' | '/api/comments';
type ImportKind = 'message' | 'share' | 'comment';

function inferImportPath(text: string): ImportPath {
  try {
    const parsed: unknown = JSON.parse(text.trim());
    if (!isRecord(parsed)) {
      return '/api/messages';
    }
    if (parsed.wrap === COMMENT_WRAP) {
      return '/api/comments';
    }
    if (parsed.share !== undefined) {
      return '/api/shares';
    }
  } catch {
    // Invalid JSON defaults to /api/messages so the API can reject it.
  }
  return '/api/messages';
}

function kindForPath(path: ImportPath): ImportKind {
  if (path === '/api/shares') {
    return 'share';
  }
  if (path === '/api/comments') {
    return 'comment';
  }
  return 'message';
}

/** POST pasted text as-is; no client-side reshaping. */
export async function postImportJsonToBackend(
  api: FeedApi,
  text: string,
): Promise<{ kind: ImportKind; id: string }> {
  const path = inferImportPath(text);
  const result = await api.postImportBody(path, text.trim());
  return { kind: kindForPath(path), id: result.id };
}

export function importApiPathForKind(
  kind: ImportKind,
): 'messages' | 'shares' | 'comments' {
  if (kind === 'share') {
    return 'shares';
  }
  if (kind === 'comment') {
    return 'comments';
  }
  return 'messages';
}
