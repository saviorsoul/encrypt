/**
 * Strip `key_ops` from a JWK before persistence or import.
 * Exported JWKs often carry a key_ops list; if it stays, importKey() may require that list to
 * match the usages you pass and can reject valid keys (e.g. ECDH public with [] vs derive-only ops).
 * Without key_ops, the `usages` argument to importKey is the source of truth.
 */
export function jwkWithoutKeyOps(jwk: JsonWebKey): JsonWebKey {
  const copy = { ...jwk };
  delete copy.key_ops;
  return copy;
}

export async function importPrivateKeyNonExtractable(
  privateJwk: JsonWebKey,
): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwkWithoutKeyOps(privateJwk),
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    ['deriveKey', 'deriveBits'],
  );
}

export async function importPublicKeyExtractable(
  publicJwk: JsonWebKey,
): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwkWithoutKeyOps(publicJwk),
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    [],
  );
}

export async function generateExtractableEcdhKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

export async function exportPublicKeyJwk(
  keyPair: CryptoKeyPair,
): Promise<JsonWebKey> {
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return jwkWithoutKeyOps(jwk);
}
