import {
  ecPublicJwkFromCoords,
  slimEcPublicJwk,
} from '@/crypto/ecPublicKey.ts';

export type ParsePublicKeyResult =
  | { ok: true; jwk: JsonWebKey }
  | { ok: false; error: string; empty?: boolean };

function parseEcPublicKeyCoords(text: string): EcPublicKeyCoordsParseResult {
  const semicolon = text.indexOf(';');
  if (semicolon <= 0) {
    return { ok: false, error: 'Public key must be x;y coordinates.' };
  }

  const x = text.slice(0, semicolon).trim();
  const y = text.slice(semicolon + 1).trim();
  if (!x || !y) {
    return { ok: false, error: 'Public key must be x;y coordinates.' };
  }

  return { ok: true, coords: { x, y } };
}

type EcPublicKeyCoordsParseResult =
  | { ok: true; coords: { x: string; y: string } }
  | { ok: false; error: string };

function parseLegacyPublicKeyJwk(text: string): ParsePublicKeyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid public key text.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'Public key must be x;y or a JSON object with x and y.',
    };
  }

  const jwk = parsed as JsonWebKey;
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    return { ok: false, error: 'Missing or invalid x / y coordinates.' };
  }
  if (jwk.d != null && jwk.d !== '') {
    return {
      ok: false,
      error: 'Public key must not include private component d.',
    };
  }

  try {
    return { ok: true, jwk: slimEcPublicJwk(jwk) };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid public key.';
    return { ok: false, error: message };
  }
}

/** Parse and validate an EC P-256 public key from `x;y` text (legacy JSON JWK also accepted). */
export function parsePublicKeyText(text: string): ParsePublicKeyResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a public key.', empty: true };
  }

  if (!trimmed.startsWith('{')) {
    const coordsResult = parseEcPublicKeyCoords(trimmed);
    if (coordsResult.ok === false) {
      return coordsResult;
    }

    try {
      return {
        ok: true,
        jwk: ecPublicJwkFromCoords(coordsResult.coords),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid public key.';
      return { ok: false, error: message };
    }
  }

  return parseLegacyPublicKeyJwk(trimmed);
}
