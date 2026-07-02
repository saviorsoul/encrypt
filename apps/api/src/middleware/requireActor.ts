import type { Middleware } from 'koa';
import type { ParameterizedContext } from 'koa';
import { forbidden, unauthorized } from '../lib/httpError.js';

type ActorResolver = (ctx: ParameterizedContext) => string | undefined;
type ActorListResolver = (ctx: ParameterizedContext) => string[];

function readAuthenticatedKeyId(ctx: ParameterizedContext): string {
  const keyId = ctx.state.authenticatedKeyId;
  if (!keyId) {
    throw unauthorized('Authentication is required.');
  }
  return keyId;
}

/** Require authenticated keyId to match a value from validated query/body. */
export function requireActor(resolveExpectedKeyId: ActorResolver): Middleware {
  return async (ctx, next) => {
    const authenticatedKeyId = readAuthenticatedKeyId(ctx);
    const expectedKeyId = resolveExpectedKeyId(ctx);

    if (!expectedKeyId) {
      throw forbidden('Missing actor keyId for this operation.');
    }

    if (authenticatedKeyId !== expectedKeyId) {
      throw forbidden(
        'Authenticated keyId does not match the requested actor.',
      );
    }

    await next();
  };
}

/** Require authenticated keyId to be one of the allowed actors. */
export function requireActorOneOf(
  resolveExpectedKeyIds: ActorListResolver,
): Middleware {
  return async (ctx, next) => {
    const authenticatedKeyId = readAuthenticatedKeyId(ctx);
    const allowed = resolveExpectedKeyIds(ctx);

    if (allowed.length === 0) {
      throw forbidden('Missing actor keyId for this operation.');
    }

    if (!allowed.includes(authenticatedKeyId)) {
      throw forbidden(
        'Authenticated keyId is not authorized for this operation.',
      );
    }

    await next();
  };
}
