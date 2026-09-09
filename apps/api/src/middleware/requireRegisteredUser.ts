import type { Middleware } from 'koa';
import {
  assertCurrentUserRegistered,
  userRepository,
} from '@/contexts/users/index.js';
import { unauthorized } from '@/lib/httpError.js';

export function requireRegisteredUser(
  feedInvitationalOnly: boolean,
): Middleware {
  return async (ctx, next) => {
    const keyId = ctx.state.authenticatedKeyId;
    const publicKey = ctx.state.authenticatedPublicKey;
    if (!keyId || !publicKey) {
      throw unauthorized('Authentication is required.');
    }
    if (feedInvitationalOnly) {
      await assertCurrentUserRegistered(keyId);
    } else {
      await userRepository.registerIfAbsent({ keyId, publicKey });
    }
    await next();
  };
}
