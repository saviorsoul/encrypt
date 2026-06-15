export const MAX_IMPORT_JSON_FILE_BYTES = 5 * 1024 * 1024;

const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_JSON_NESTING_DEPTH = 16;
const SIZE_LIMIT_ERROR = `File exceeds the maximum allowed size (${Math.floor(MAX_IMPORT_JSON_FILE_BYTES / (1024 * 1024))} MB).`;

/** @param {string} error */
function failJson(error) {
  return { ok: false, error };
}

/** @param {unknown} value */
function isPlainJsonObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {string | null}
 */
function assertSafeJsonKeys(value, depth = 0) {
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

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_JSON_KEYS.has(key)) {
      return 'JSON contains unsupported keys.';
    }

    const nestedError = assertSafeJsonKeys(value[key], depth + 1);
    if (nestedError) {
      return nestedError;
    }
  }

  return null;
}

/** @param {string} text */
function stripUtf8Bom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse JSON text, reject unsafe shapes, and return the canonical object.
 * Does not validate manifest, JWK, or other domain-specific schemas.
 *
 * @param {string} text
 * @returns {{ ok: true; text: string; parsed: Record<string, unknown> } | { ok: false; error: string }}
 */
export function validateBaseJsonText(text) {
  const trimmed = stripUtf8Bom(text.trim());
  if (!trimmed) {
    return failJson('JSON is empty.');
  }

  if (trimmed.length > MAX_IMPORT_JSON_FILE_BYTES) {
    return failJson(SIZE_LIMIT_ERROR);
  }

  let parsed;
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
