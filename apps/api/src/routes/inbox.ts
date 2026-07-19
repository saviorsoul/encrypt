import Router from '@koa/router';
import { handleListInbox } from '@/contexts/feed/index.js';
import { unauthorized } from '@/lib/httpError.js';

export function createInboxRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/inbox', async (ctx) => {
    const recipientKeyId = ctx.state.authenticatedKeyId;
    if (!recipientKeyId) {
      throw unauthorized('Authentication is required.');
    }

    ctx.body = await handleListInbox({ recipientKeyId });
  });

  return router;
}
