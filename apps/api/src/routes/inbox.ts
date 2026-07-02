import Router from '@koa/router';
import { unauthorized } from '../lib/httpError.js';
import { listInboxItemsForRecipientKeyId } from '../db/inbox.js';

export function createInboxRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/inbox', async (ctx) => {
    const recipientKeyId = ctx.state.authenticatedKeyId;
    if (!recipientKeyId) {
      throw unauthorized('Authentication is required.');
    }

    ctx.body = await listInboxItemsForRecipientKeyId(recipientKeyId);
  });

  return router;
}
