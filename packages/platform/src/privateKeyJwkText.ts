import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { validateBaseJsonText } from '@encrypt/core/utils/validateBaseJsonText';

export type ParsePrivateKeyJwkResult =
  | { ok: true; jwk: JsonWebKey }
  | { ok: false; error: string };

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
