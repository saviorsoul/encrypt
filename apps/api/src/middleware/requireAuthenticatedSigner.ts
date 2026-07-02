import type { Middleware } from 'koa';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { forbidden, unauthorized } from '../lib/httpError.js';

function readBodyPath(body: unknown, path: string): unknown {
  if (!path) {
    return body;
  }

  let current: unknown = body;
  for (const segment of path.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !(segment in (current as Record<string, unknown>))
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

type RequireAuthenticatedSignerOptions = {
  bodyPath?: string;
  jwkField: string;
};

/**
 * Bind encrypted-payload identity to API caller identity.
 *
 * Compares the thumbprint of `jwkField` in the body (e.g. senderPublicJwk)
 * to ctx.state.authenticatedKeyId set by authenticate().
 *
 * Does not verify senderSignature — use verifySignature for that.
 * Not used on plaintext routes (friendships, inbox reads, etc.).
 */
export function requireAuthenticatedSigner(
  options: RequireAuthenticatedSignerOptions,
): Middleware {
  const bodyPath = options.bodyPath ?? '';

  return async (ctx, next) => {
    const authenticatedKeyId = ctx.state.authenticatedKeyId;
    if (!authenticatedKeyId) {
      throw unauthorized('Authentication is required.');
    }

    const payload = readBodyPath(ctx.request.body, bodyPath);
    if (payload === null || typeof payload !== 'object') {
      throw forbidden('Missing signed payload for sender binding.');
    }

    const signerPublicJwk = (payload as Record<string, unknown>)[
      options.jwkField
    ];
    if (signerPublicJwk === null || typeof signerPublicJwk !== 'object') {
      throw forbidden(`Missing ${options.jwkField} for sender binding.`);
    }

    const signerKeyId = await ecPublicJwkThumbprintSha256(
      slimEcPublicJwk(signerPublicJwk as JsonWebKey),
    );

    if (signerKeyId !== authenticatedKeyId) {
      throw forbidden('Payload signer does not match authenticated keyId.');
    }

    await next();
  };
}
