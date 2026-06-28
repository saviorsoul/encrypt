/**
 * Feed / manifest import validation and browser File reads.
 * Builds on validateBaseJsonText.ts (safe parse) + domain schema checks.
 */
import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';
import { parseManifestPayloadText } from '@/utils/parseManifestPayloadText.ts';
import {
  MAX_IMPORT_JSON_FILE_BYTES,
  validateBaseJsonText,
} from '@/utils/validateBaseJsonText.ts';

export type ValidatedImportJsonResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function fail(error: string): ValidatedImportJsonResult {
  return { ok: false, error };
}

/** File metadata checks only — content is validated by the supplied text validator. */
function assertSafeJsonFileMetadata(file: File): string | null {
  if (file.size > MAX_IMPORT_JSON_FILE_BYTES) {
    return `File exceeds the maximum allowed size (${Math.floor(MAX_IMPORT_JSON_FILE_BYTES / (1024 * 1024))} MB).`;
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

type ParsePayloadTextResult = { ok: true } | { ok: false; error: string };

function validateJsonText(
  text: string,
  parsePayload: (text: string) => ParsePayloadTextResult,
): ValidatedImportJsonResult {
  const base = validateBaseJsonText(text);
  if (base.ok === false) {
    return base;
  }

  const parsed = parsePayload(base.text);
  if (parsed.ok === false) {
    return fail(parsed.error);
  }

  return { ok: true, text: base.text };
}

/**
 * Parse import text as JSON, reject unsafe shapes, validate feed import schema,
 * and return canonical JSON text safe to pass into import logic.
 */
export function validateImportJsonText(
  text: string,
): ValidatedImportJsonResult {
  return validateJsonText(text, parseImportPayloadText);
}

/**
 * Parse import text as JSON, reject unsafe shapes, validate manifest schema,
 * and return canonical JSON text safe to pass into one-to-one decrypt logic.
 */
export function validateManifestJsonText(
  text: string,
): ValidatedImportJsonResult {
  return validateJsonText(text, parseManifestPayloadText);
}

/** Read a .json file and validate contents with the given text validator. */
export async function readValidatedJsonFromFile(
  file: File,
  validateText: (text: string) => ValidatedImportJsonResult,
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

  return validateText(text);
}
