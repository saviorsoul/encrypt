export function jwkWithoutKeyOps(jwk: JsonWebKey): JsonWebKey {
  const copy = { ...jwk };
  delete copy.key_ops;
  return copy;
}

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
