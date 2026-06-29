import Router from '@koa/router';
import type { CreateShareRequest } from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';

/** Stub route for exercising createShareRequest schema validation. */
export function createSharesRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post('/shares', validateBody('createShareRequest'), (ctx) => {
    const body = ctx.request.body as CreateShareRequest;
    ctx.status = 201;
    ctx.body = {
      id: (body.share as { parentMessageId: string }).parentMessageId,
    };
  });

  return router;
}
