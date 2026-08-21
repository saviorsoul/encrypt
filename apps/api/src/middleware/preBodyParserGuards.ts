import type { Middleware } from 'koa';
import { MAX_BODY_BYTES } from '../constants.js';
import {
  badRequest,
  payloadTooLarge,
  unsupportedMediaType,
} from '../lib/httpError.js';

const MUTATING_WITH_BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function hasRequestPayload(ctx: { get(name: string): string }): boolean {
  const contentLengthHeader = ctx.get('content-length');
  if (contentLengthHeader.length === 0) {
    return false;
  }

  const contentLength = Number(contentLengthHeader);
  return Number.isFinite(contentLength) && contentLength > 0;
}

/** Reject oversized or non-JSON payloads before bodyParser reads the stream. */
export function preBodyParserGuards(): Middleware {
  return async (ctx, next) => {
    const contentLengthHeader = ctx.get('content-length');
    if (contentLengthHeader.length > 0) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        throw badRequest('Invalid Content-Length.');
      }
      if (contentLength > MAX_BODY_BYTES) {
        throw payloadTooLarge(
          `Request body must not exceed ${MAX_BODY_BYTES} bytes.`,
        );
      }
    }

    const requiresJsonBody =
      MUTATING_WITH_BODY_METHODS.has(ctx.method) ||
      (ctx.method === 'DELETE' && hasRequestPayload(ctx));

    if (requiresJsonBody && !ctx.is('json')) {
      throw unsupportedMediaType('Content-Type must be application/json.');
    }

    await next();
  };
}
