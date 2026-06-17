/** Hardcoded EC P-256 public key parameters (not required in user-facing key text). */
export const EC_PUBLIC_KTY = 'EC';
export const EC_PUBLIC_CRV = 'P-256';

export type EcPublicKeyCoords = {
  x: string;
  y: string;
};

type EcPublicKeyCoordsInput = Pick<JsonWebKey, 'x' | 'y'>;

function getEcPublicCoords(source: EcPublicKeyCoordsInput): EcPublicKeyCoords {
  const { x, y } = source;
  if (typeof x !== 'string' || typeof y !== 'string' || !x || !y) {
    throw new Error('Expected EC public key with x and y coordinates.');
  }
  return { x, y };
}

/** Build a Web Crypto JWK from x/y coordinates; kty and crv are always P-256 EC. */
export function ecPublicJwkFromCoords(
  coords: EcPublicKeyCoords | EcPublicKeyCoordsInput,
): JsonWebKey {
  const { x, y } = getEcPublicCoords(coords);
  return { kty: EC_PUBLIC_KTY, crv: EC_PUBLIC_CRV, x, y };
}

/** Extract x/y from any JWK-shaped object; kty and crv are ignored. */
export function ecPublicCoordsFromJwk(jwk: JsonWebKey): EcPublicKeyCoords {
  return getEcPublicCoords(jwk);
}

/** Normalize to minimal JWK with hardcoded kty/crv. */
export function slimEcPublicJwk(jwk: JsonWebKey): JsonWebKey {
  return ecPublicJwkFromCoords(jwk);
}

/** One-line public key text: `x;y`. */
export function formatEcPublicKeyText(jwk: JsonWebKey): string {
  const { x, y } = ecPublicCoordsFromJwk(jwk);
  return `${x};${y}`;
}
