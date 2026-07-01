import Router from '@koa/router';
import { validateQuery } from '../middleware/validateQuery.js';
import type { RecipientKeyIdQuery } from '../schemas/query.js';
import { listInboxItemsForRecipientKeyId } from '../db/inbox.js';

export function createInboxRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/inbox', validateQuery('recipientKeyIdQuery'), async (ctx) => {
    const { recipientKeyId } = ctx.state.validatedQuery as RecipientKeyIdQuery;
    const items = await listInboxItemsForRecipientKeyId(recipientKeyId);
    ctx.body = items;
  });

  return router;
}
