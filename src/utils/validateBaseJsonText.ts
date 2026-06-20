/**
 * Low-level safe JSON parsing for untrusted text (paste, files, payloads).
 * No manifest / import / JWK schema checks — use readImportJsonFile.ts for those.
 */
export const MAX_IMPORT_JSON_FILE_BYTES = 5 * 1024 * 1024;

const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_JSON_NESTING_DEPTH = 16;
const SIZE_LIMIT_ERROR = `File exceeds the maximum allowed size (${Math.floor(MAX_IMPORT_JSON_FILE_BYTES / (1024 * 1024))} MB).`;

export type ValidatedBaseJsonResult =
  | { ok: true; text: string; parsed: Record<string, unknown> }
  | { ok: false; error: string };

function failJson(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSafeJsonKeys(value: unknown, depth = 0): string | null {
  if (depth > MAX_JSON_NESTING_DEPTH) {
    return 'JSON nesting is too deep.';
  }

  if (value === null || typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedError = assertSafeJsonKeys(item, depth + 1);
      if (nestedError) {
        return nestedError;
      }
    }
    return null;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_JSON_KEYS.has(key)) {
      return 'JSON contains unsupported keys.';
    }

    const nestedError = assertSafeJsonKeys(
      (value as Record<string, unknown>)[key],
      depth + 1,
    );
    if (nestedError) {
      return nestedError;
    }
  }

  return null;
}

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse JSON text, reject unsafe shapes, and return the canonical object.
 * Does not validate manifest, JWK, or other domain-specific schemas.
 */
export function validateBaseJsonText(text: string): ValidatedBaseJsonResult {
  const trimmed = stripUtf8Bom(text.trim());
  if (!trimmed) {
    return failJson('JSON is empty.');
  }

  if (trimmed.length > MAX_IMPORT_JSON_FILE_BYTES) {
    return failJson(SIZE_LIMIT_ERROR);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return failJson('Invalid JSON syntax.');
  }

  if (!isPlainJsonObject(parsed)) {
    return failJson('JSON root must be an object.');
  }

  const unsafeKeyError = assertSafeJsonKeys(parsed);
  if (unsafeKeyError) {
    return failJson(unsafeKeyError);
  }

  return { ok: true, text: JSON.stringify(parsed), parsed };
}

/** Throwing helper for call sites that already use exception-based control flow. */
export function parseBaseJsonObjectOrThrow(
  text: string,
): Record<string, unknown> {
  const result = validateBaseJsonText(text);
  if (result.ok === false) {
    throw new Error(result.error);
  }
  return result.parsed;
}
