import Router from '@koa/router';
import { API_PATH } from '@/config.js';
import { handleListInbox } from '@/contexts/feed/index.js';
import {
  normalizeQuery,
  type InboxRouteContext,
} from '@/middleware/normalizeQuery.js';
import { validateQuery } from '@/middleware/validateQuery.js';
import { unauthorized } from '@/lib/httpError.js';

export function createInboxRouter(): Router {
  const router = new Router({ prefix: API_PATH });

  router.get(
    '/inbox',
    validateQuery('inboxQuery'),
    normalizeQuery('inboxQuery'),
    async (ctx: InboxRouteContext) => {
      const recipientKeyId = ctx.state.authenticatedKeyId;
      if (!recipientKeyId) {
        throw unauthorized('Authentication is required.');
      }

      const { validatedQuery } = ctx.state;

      ctx.body = await handleListInbox({
        recipientKeyId,
        ...validatedQuery,
      });
    },
  );

  return router;
}
