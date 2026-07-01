import type { Prisma } from '@prisma/client';
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
