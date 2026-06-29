import { jwkWithoutKeyOps } from '../crypto/ecdhKeys.ts';

/** Import an EC private JWK for ECDSA signing (same curve material as ECDH keys). */
export async function importPrivateKeyForEcdsaSign(
  privateJwk: JsonWebKey,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwkWithoutKeyOps(privateJwk),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign'],
  );
}

/** Import an EC public JWK for ECDSA signature verification. */
export async function importPublicKeyForEcdsaVerify(
  publicJwk: JsonWebKey,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwkWithoutKeyOps(publicJwk),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify'],
  );
}
