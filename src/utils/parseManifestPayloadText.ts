import { validateManifestPayload } from '@/crypto/manifestDecrypt.ts';
import type { ManifestPayload } from '@/types/manifest.ts';

export type ParseManifestPayloadResult =
  | { ok: true; payload: ManifestPayload }
  | { ok: false; error: string };

/** Parse and validate signed manifest JSON text without throwing. */
export function parseManifestPayloadText(
  text: string,
): ParseManifestPayloadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  const validationError = validateManifestPayload(parsed as ManifestPayload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  return { ok: true, payload: parsed as ManifestPayload };
}
