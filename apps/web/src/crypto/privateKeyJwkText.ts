import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import { validateBaseJsonText } from '@/utils/validateBaseJsonText.ts';

export type ParsePrivateKeyJwkResult =
  | { ok: true; jwk: JsonWebKey }
  | { ok: false; error: string };

/** Parse and syntactically validate an EC P-256 private JWK from JSON text. */
export function parsePrivateKeyJwkText(text: string): ParsePrivateKeyJwkResult {
  const base = validateBaseJsonText(text);
  if (base.ok === false) {
    return { ok: false, error: base.error };
  }

  try {
    return { ok: true, jwk: slimEcPrivateJwk(base.parsed as JsonWebKey) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid private key JWK.';
    return { ok: false, error: message };
  }
}

export function readPrivateKeyJwkFromText(text: string): JsonWebKey {
  const parsed = parsePrivateKeyJwkText(text);
  if (parsed.ok === false) {
    throw new Error(parsed.error);
  }
  return parsed.jwk;
}
