import { bytesToBase64Url } from '@/utils/bytes.ts';

/** Minimal EC public JWK (`kty`, `crv`, `x`, `y`); strips Web Crypto `ext` / `key_ops`. */
export function slimEcPublicJwk(jwk: JsonWebKey): JsonWebKey {
  const { kty, crv, x, y } = jwk;
  if (kty !== 'EC' || !crv || !x || !y) {
    throw new Error('Expected EC public JWK with kty, crv, x, y');
  }
  return { kty, crv, x, y };
}

/** Minimal EC private JWK (`kty`, `crv`, `x`, `y`, `d`); strips Web Crypto `ext` / `key_ops`. */
export function slimEcPrivateJwk(jwk: JsonWebKey): JsonWebKey {
  const { kty, crv, x, y, d } = jwk;
  if (kty !== 'EC' || !crv || !x || !y || !d) {
    throw new Error('Expected EC private JWK with kty, crv, x, y, d');
  }
  return { kty, crv, x, y, d };
}

/**
 * {@link https://www.rfc-editor.org/rfc/rfc7638 RFC 7638} JWK thumbprint (SHA-256, base64url)
 * for an Elliptic Curve **public** key. Uses canonical members `crv`, `kty`, `x`, `y` only
 * so the id uniquely identifies the full public point (unlike `x` alone).
 */
export async function ecPublicJwkThumbprintSha256(
  jwk: JsonWebKey,
): Promise<string> {
  const { crv, kty, x, y } = slimEcPublicJwk(jwk);
  const canonical = JSON.stringify({ crv, kty, x, y });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

/**
 * RFC 7638 thumbprint from a Web Crypto public key, using the same exported `x`/`y`
 * encoding as manifest `keyManifest` entries (avoids mismatches with pasted JWK text).
 */
export async function ecPublicJwkThumbprintFromCryptoKey(
  publicKey: CryptoKey,
): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return ecPublicJwkThumbprintSha256(slimEcPublicJwk(jwk));
}
