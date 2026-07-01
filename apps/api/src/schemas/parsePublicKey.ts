import type { Prisma } from '@prisma/client';
import { ecPublicJwkFromCoords } from '@encrypt/core/crypto/ecPublicKey';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { badRequest } from '../lib/httpError.js';

/** Parse AJV-validated EC public JWK for Prisma Json column writes. */
export function parsePublicKey(
  wire: Record<string, unknown> | JsonWebKey,
): Prisma.InputJsonValue {
  const { kty, crv, x, y } = wire;
  if (
    kty !== 'EC' ||
    crv !== 'P-256' ||
    typeof x !== 'string' ||
    !x ||
    typeof y !== 'string' ||
    !y
  ) {
    throw badRequest('publicKey must be a slim EC P-256 JWK.');
  }

  return { kty, crv, x, y };
}

/** Parse wire publicKey (`x;y` string or object with x and y) for Prisma Json writes. */
export function parseWirePublicKey(
  wire: string | Record<string, unknown> | JsonWebKey,
): Prisma.InputJsonValue {
  if (typeof wire === 'string') {
    const semicolon = wire.indexOf(';');
    if (semicolon <= 0) {
      throw badRequest(
        'publicKey must be x;y coordinates or an object with x and y.',
      );
    }
    const x = wire.slice(0, semicolon).trim();
    const y = wire.slice(semicolon + 1).trim();
    if (!x || !y) {
      throw badRequest(
        'publicKey must be x;y coordinates or an object with x and y.',
      );
    }
    return parsePublicKey(ecPublicJwkFromCoords({ x, y }));
  }

  const { x, y, d } = wire;
  if (typeof x === 'string' && typeof y === 'string') {
    if (d != null && d !== '') {
      throw badRequest('publicKey must not include private component d.');
    }
    return parsePublicKey(ecPublicJwkFromCoords({ x, y }));
  }

  throw badRequest(
    'publicKey must be x;y coordinates or an object with x and y.',
  );
}

/** Derive RFC 7638 keyId from wire publicKey. */
export async function keyIdFromWirePublicKey(
  wire: string | Record<string, unknown> | JsonWebKey,
): Promise<string> {
  const publicKey = parseWirePublicKey(wire);
  return ecPublicJwkThumbprintSha256(slimEcPublicJwk(publicKey as JsonWebKey));
}

/** Ensure keyId is the RFC 7638 JWK thumbprint of publicKey. */
export async function validateKeyIdPublicKeyPairOrThrow(
  keyId: string,
  wire: Record<string, unknown> | JsonWebKey,
): Promise<void> {
  const publicKey = parsePublicKey(wire);
  const jwk = slimEcPublicJwk(publicKey as JsonWebKey);
  const expectedKeyId = await ecPublicJwkThumbprintSha256(jwk);

  if (keyId !== expectedKeyId) {
    throw badRequest('keyId does not match publicKey thumbprint.');
  }
}
