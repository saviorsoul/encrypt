import { validateBaseJsonText } from '@encrypt/core/utils/validateBaseJsonText';
import type { ValidatedImportJsonResult } from '@encrypt/core/feed/readImportJsonFile';

/** Syntax-only JSON checks for feed-lab (no import/manifest schema validation). */
export function validateJsonSyntaxText(
  text: string,
): ValidatedImportJsonResult {
  const result = validateBaseJsonText(text);
  if (result.ok === false) {
    return result;
  }
  return { ok: true, text: result.text };
}

export function jsonSyntaxError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const result = validateJsonSyntaxText(trimmed);
  return result.ok === false ? result.error : null;
}
