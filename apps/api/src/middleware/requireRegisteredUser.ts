import type { Middleware } from 'koa';
import { assertCurrentUserRegistered } from '@/contexts/users/index.js';
import { unauthorized } from '@/lib/httpError.js';

export function requireRegisteredUser(): Middleware {
  return async (ctx, next) => {
    const keyId = ctx.state.authenticatedKeyId;
    if (!keyId) {
      throw unauthorized('Authentication is required.');
    }
    await assertCurrentUserRegistered(keyId);
    await next();
  };
}
