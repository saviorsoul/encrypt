/** Hardcoded EC P-256 public key parameters (not required in user-facing key text). */
export const EC_PUBLIC_KTY = 'EC';
export const EC_PUBLIC_CRV = 'P-256';

/** P-256 field element size in bytes (unsigned big-endian). */
export const EC_P256_COORD_BYTES = 32;

/** Base64url wire length for a fixed-width P-256 coordinate (no padding). */
export const EC_P256_COORD_BASE64URL_LENGTH = Math.ceil(
  (EC_P256_COORD_BYTES * 8) / 6,
);

/** Base64url alphabet for a fixed-width P-256 coordinate. */
export const EC_P256_COORD_BASE64URL_PATTERN = `^[A-Za-z0-9_-]{${EC_P256_COORD_BASE64URL_LENGTH}}$`;

/** `x;y` public-key text: two fixed-width base64url coordinates. */
export const EC_P256_COORDS_WIRE_TEXT_LENGTH =
  EC_P256_COORD_BASE64URL_LENGTH * 2 + 1;

export const EC_P256_COORDS_WIRE_TEXT_PATTERN = `^[A-Za-z0-9_-]{${EC_P256_COORD_BASE64URL_LENGTH}};[A-Za-z0-9_-]{${EC_P256_COORD_BASE64URL_LENGTH}}$`;

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
