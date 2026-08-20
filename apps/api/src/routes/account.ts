import Router from '@koa/router';
import { API_PATH } from '@/config.js';
import { unauthorized } from '@/lib/httpError.js';
import { handleClearAccount } from '@/contexts/users/application/commands/clearAccount/clearAccount.handler.js';

export function createAccountRouter(): Router {
  const router = new Router({ prefix: API_PATH });

  router.delete('/account', async (ctx) => {
    const keyId = ctx.state.authenticatedKeyId;
    if (!keyId) {
      throw unauthorized('Authentication is required.');
    }
    await handleClearAccount({ keyId });
    ctx.status = 204;
  });

  return router;
}
