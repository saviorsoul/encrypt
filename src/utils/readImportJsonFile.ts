import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';

export const MAX_IMPORT_JSON_FILE_BYTES = 2 * 1024 * 1024;

const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_JSON_NESTING_DEPTH = 16;
const SIZE_LIMIT_ERROR = 'File exceeds the maximum allowed size (2 MB).';

export type ValidatedImportJsonResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function fail(error: string): ValidatedImportJsonResult {
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

/** File metadata checks only — content is validated by {@link validateImportJsonText}. */
function assertSafeJsonFileMetadata(file: File): string | null {
  if (file.size > MAX_IMPORT_JSON_FILE_BYTES) {
    return SIZE_LIMIT_ERROR;
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    return 'Only .json files are accepted.';
  }

  if (
    file.type &&
    file.type !== 'application/json' &&
    file.type !== 'text/json'
  ) {
    return 'File must be JSON (application/json).';
  }

  return null;
}

/**
 * Parse import text as JSON, reject unsafe shapes, validate manifest schema,
 * and return canonical JSON text safe to pass into import logic.
 */
export function validateImportJsonText(
  text: string,
): ValidatedImportJsonResult {
  const trimmed = stripUtf8Bom(text.trim());
  if (!trimmed) {
    return fail('JSON is empty.');
  }

  if (trimmed.length > MAX_IMPORT_JSON_FILE_BYTES) {
    return fail(SIZE_LIMIT_ERROR);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return fail('Invalid JSON syntax.');
  }

  if (!isPlainJsonObject(parsed)) {
    return fail('JSON root must be an object.');
  }

  const unsafeKeyError = assertSafeJsonKeys(parsed);
  if (unsafeKeyError) {
    return fail(unsafeKeyError);
  }

  const importResult = parseImportPayloadText(trimmed);
  if (importResult.ok === false) {
    return fail(importResult.error);
  }

  return { ok: true, text: JSON.stringify(parsed) };
}

/** Read a .json file, validate contents, and return canonical import JSON text. */
export async function readValidatedImportJsonFromFile(
  file: File,
): Promise<ValidatedImportJsonResult> {
  const metadataError = assertSafeJsonFileMetadata(file);
  if (metadataError) {
    return fail(metadataError);
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return fail('Failed to read file.');
  }

  return validateImportJsonText(text);
}
