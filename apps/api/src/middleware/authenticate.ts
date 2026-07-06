import type { Middleware } from 'koa';
import {
  AUTH_HEADER_KEY_ID,
  AUTH_HEADER_NEXT_NONCE,
  AUTH_HEADER_NEXT_NONCE_EXPIRES_AT,
  AUTH_HEADER_NONCE,
  AUTH_HEADER_PUBLIC_KEY,
  AUTH_HEADER_SIGNATURE,
  AUTH_HEADER_TIME_SLOT,
  assertAuthKeyIdMatchesPublicKey,
  buildAuthRequestDescriptorFromContext,
  isAuthTimeSlotAccepted,
  parseAuthNonceHeader,
  parseAuthPublicKeyWire,
  parseAuthTimeSlotHeader,
  verifyAuthProof,
} from '@encrypt/core/crypto/authProof';
import { slimEcPublicJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { ecPublicJwkFromCoords } from '@encrypt/core/crypto/ecPublicKey';
import { consumeAuthNonce, mintAuthNonce } from '../services/authNonce.js';
import { unauthorized } from '../lib/httpError.js';

function readHeader(
  ctx: { get: (name: string) => string | undefined },
  name: string,
): string {
  const value = ctx.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function authenticate(): Middleware {
  return async (ctx, next) => {
    const keyId = readHeader(ctx, AUTH_HEADER_KEY_ID);
    const publicKeyWire = readHeader(ctx, AUTH_HEADER_PUBLIC_KEY);
    const signature = readHeader(ctx, AUTH_HEADER_SIGNATURE);
    const timeSlot = parseAuthTimeSlotHeader(
      readHeader(ctx, AUTH_HEADER_TIME_SLOT),
    );
    const nonce = parseAuthNonceHeader(readHeader(ctx, AUTH_HEADER_NONCE));

    if (!keyId || !publicKeyWire || !signature || timeSlot === null || !nonce) {
      throw unauthorized('Missing or invalid API authentication headers.');
    }

    if (!isAuthTimeSlotAccepted(timeSlot)) {
      throw unauthorized(
        'Authentication time slot is outside the accepted window.',
      );
    }

    let publicKeyCoords;
    try {
      publicKeyCoords = parseAuthPublicKeyWire(publicKeyWire);
      await assertAuthKeyIdMatchesPublicKey(keyId, publicKeyCoords);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid public key.';
      throw unauthorized(message);
    }

    const publicJwk = slimEcPublicJwk(ecPublicJwkFromCoords(publicKeyCoords));
    const request = buildAuthRequestDescriptorFromContext(ctx);

    try {
      await verifyAuthProof(
        publicJwk,
        keyId,
        { timeSlot, nonce },
        signature,
        request,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Authentication failed.';
      throw unauthorized(message);
    }

    // Consume before route validation (ADR 0012): valid proofs are single-use
    // even when later middleware or the handler returns 4xx/5xx.
    const consumed = await consumeAuthNonce(keyId, nonce);
    if (!consumed) {
      throw unauthorized('Authentication nonce is invalid or already used.');
    }

    const nextNonce = await mintAuthNonce(keyId);
    ctx.set(AUTH_HEADER_NEXT_NONCE, nextNonce.nonce);
    ctx.set(AUTH_HEADER_NEXT_NONCE_EXPIRES_AT, String(nextNonce.expiresAtMs));
    ctx.state.authenticatedKeyId = keyId;
    ctx.state.authenticatedPublicKey = publicKeyCoords;
    await next();
  };
}

declare module 'koa' {
  interface DefaultState {
    authenticatedKeyId?: string;
    authenticatedPublicKey?: { x: string; y: string };
  }
}
