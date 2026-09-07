import type { Middleware } from 'koa';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { verifyManifestShareSignature } from '@/crypto/signatures.js';
import type { CreateShareBatchRequest } from '@/schemas/common.js';
import { badRequest, forbidden, unauthorized } from '@/lib/httpError.js';

export function requireBatchShareSigner(): Middleware {
  return async (ctx, next) => {
    const authenticatedKeyId = ctx.state.authenticatedKeyId;
    if (!authenticatedKeyId) {
      throw unauthorized('Authentication is required.');
    }

    const body = ctx.request.body as CreateShareBatchRequest;
    if (!Array.isArray(body.shares) || body.shares.length === 0) {
      throw badRequest('shares must be a non-empty array.');
    }

    for (const item of body.shares) {
      const share = item.share as {
        sharerPublicJwk?: JsonWebKey;
      };
      if (!share?.sharerPublicJwk) {
        throw forbidden('Missing sharerPublicJwk for sender binding.');
      }

      const signerKeyId = await ecPublicJwkThumbprintSha256(
        slimEcPublicJwk(share.sharerPublicJwk),
      );
      if (signerKeyId !== authenticatedKeyId) {
        throw forbidden('Payload signer does not match authenticated keyId.');
      }

      try {
        await verifyManifestShareSignature(
          share as Parameters<typeof verifyManifestShareSignature>[0],
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Signature verification failed.';
        throw badRequest(message);
      }
    }

    await next();
  };
}
