import {
  isManifestPayload,
  validateManifestPayload,
} from '@/crypto/manifestDecrypt.ts';
import type { ManifestPayload } from '@/types/manifest.ts';
import { validateBaseJsonText } from '@/utils/validateBaseJsonText.ts';

export type ParseJsonObjectResult =
  | { ok: true; parsed: Record<string, unknown> }
  | { ok: false; error: string };

export type ParseManifestPayloadResult =
  | { ok: true; payload: ManifestPayload }
  | { ok: false; error: string };

/** Parse JSON text and require a plain object root with safe key shapes. */
export function parseJsonObjectText(text: string): ParseJsonObjectResult {
  const base = validateBaseJsonText(text);
  if (base.ok === false) {
    return { ok: false, error: base.error };
  }

  return { ok: true, parsed: base.parsed };
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
