import { slimEcPublicJwk } from '@/crypto/jwkThumbprint.ts';

export type ParsePublicKeyJwkResult =
  | { ok: true; jwk: JsonWebKey }
  | { ok: false; error: string; empty?: boolean };

/** Parse and syntactically validate an EC P-256 public JWK from JSON text. */
export function parsePublicKeyJwkText(text: string): ParsePublicKeyJwkResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a public key JWK.', empty: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'JWK must be a JSON object.' };
  }

  const jwk = parsed as JsonWebKey;
  if (jwk.kty !== 'EC') {
    return { ok: false, error: 'Expected kty "EC".' };
  }
  if (jwk.crv !== 'P-256') {
    return { ok: false, error: 'Expected crv "P-256".' };
  }
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    return { ok: false, error: 'Missing or invalid x / y coordinates.' };
  }
  if (jwk.d != null && jwk.d !== '') {
    return {
      ok: false,
      error: 'Public JWK must not include private component d.',
    };
  }

  try {
    return { ok: true, jwk: slimEcPublicJwk(jwk) };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid public key JWK.';
    return { ok: false, error: message };
  }
}
