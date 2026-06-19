import {
  isManifestPayload,
  validateManifestPayload,
} from '@/crypto/manifestDecrypt.ts';
import type { ManifestPayload } from '@/types/manifest.ts';

export type ParseJsonObjectResult =
  | { ok: true; parsed: Record<string, unknown> }
  | { ok: false; error: string };

export type ParseManifestPayloadResult =
  | { ok: true; payload: ManifestPayload }
  | { ok: false; error: string };

/** Parse JSON text and require a plain object root. */
export function parseJsonObjectText(text: string): ParseJsonObjectResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  return { ok: true, parsed: parsed as Record<string, unknown> };
}

/** Parse and validate signed manifest JSON text without throwing. */
export function parseManifestPayloadText(
  text: string,
): ParseManifestPayloadResult {
  const json = parseJsonObjectText(text);
  if (json.ok === false) {
    return json;
  }

  if (!isManifestPayload(json.parsed)) {
    return {
      ok: false,
      error: validateManifestPayload(json.parsed) ?? 'Invalid manifest.',
    };
  }

  return { ok: true, payload: json.parsed };
}
