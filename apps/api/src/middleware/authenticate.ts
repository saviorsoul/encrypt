import type { Middleware } from 'koa';
import {
  AUTH_HEADER_NEXT_NONCE,
  AUTH_HEADER_NEXT_NONCE_EXPIRES_AT,
  assertAuthKeyIdMatchesPublicKey,
  buildAuthRequestDescriptorFromContext,
  isAuthTimeSlotAccepted,
  parseAuthNonceHeader,
  parseAuthPublicKeyWire,
  verifyAuthProof,
} from '@encrypt/core/crypto/authProof';
import { slimEcPublicJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { ecPublicJwkFromCoords } from '@encrypt/core/crypto/ecPublicKey';
import { consumeAndRotateAuthNonce } from '@/contexts/auth/index.js';
import { unauthorized } from '@/lib/httpError.js';
import { logger } from '@/lib/logger.js';
import { parseAuthHeadersWire } from './parseAuthHeadersWire.js';
import { validateAuthHeadersWireResult } from './validateAuthHeadersWire.js';

export function authenticate(): Middleware {
  return async (ctx, next) => {
    const wire = parseAuthHeadersWire(ctx);
    if (!wire) {
      logger.debug(
        {
          method: ctx.method,
          path: ctx.path,
          schema: 'authHeadersWire',
          outcome: 'missing',
        },
        'auth header validation failed',
      );
      throw unauthorized('Missing or invalid API authentication headers.');
    }

    const headerValidation = validateAuthHeadersWireResult(wire);
    if (!headerValidation.valid) {
      logger.debug(
        {
          method: ctx.method,
          path: ctx.path,
          schema: 'authHeadersWire',
          outcome: 'schema_mismatch',
          errors: headerValidation.errors,
        },
        'auth header validation failed',
      );
      throw unauthorized('Missing or invalid API authentication headers.');
    }

    const nonce = parseAuthNonceHeader(wire.nonce);
    if (!nonce) {
      logger.debug(
        {
          method: ctx.method,
          path: ctx.path,
          schema: 'authHeadersWire',
          outcome: 'invalid_nonce',
        },
        'auth header validation failed',
      );
      throw unauthorized('Missing or invalid API authentication headers.');
    }

    logger.debug(
      {
        method: ctx.method,
        path: ctx.path,
        schema: 'authHeadersWire',
        outcome: 'valid',
      },
      'auth header validation passed',
    );

    if (!isAuthTimeSlotAccepted(wire.timeSlot)) {
      throw unauthorized(
        'Authentication time slot is outside the accepted window.',
      );
    }

    let publicKeyCoords;
    try {
      publicKeyCoords = parseAuthPublicKeyWire(wire.publicKey);
      await assertAuthKeyIdMatchesPublicKey(wire.keyId, publicKeyCoords);
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
        wire.keyId,
        { timeSlot: wire.timeSlot, nonce },
        wire.signature,
        request,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Authentication failed.';
      throw unauthorized(message);
    }

    // Consume before route validation (ADR 0012): valid proofs are single-use
    // even when later middleware or the handler returns 4xx/5xx.
    const nonceOutcome = await consumeAndRotateAuthNonce(wire.keyId, nonce);

    ctx.set(AUTH_HEADER_NEXT_NONCE, nonceOutcome.entry.nonce);
    ctx.set(
      AUTH_HEADER_NEXT_NONCE_EXPIRES_AT,
      String(nonceOutcome.entry.expiresAtMs),
    );

    if (nonceOutcome.status === 'minted') {
      throw unauthorized('Authentication nonce is expired or missing.');
    }

    if (nonceOutcome.status === 'mismatch') {
      throw unauthorized('Authentication nonce is invalid or already used.');
    }

    ctx.state.authenticatedKeyId = wire.keyId;
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
