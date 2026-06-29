import { randomUUID } from 'node:crypto';
import Router from '@koa/router';
import { validateBody } from '../middleware/validateBody.js';

/** Stub route for exercising createMessageRequest schema validation. */
export function createMessagesRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post('/messages', validateBody('createMessageRequest'), (ctx) => {
    ctx.status = 201;
    ctx.body = { id: randomUUID() };
  });

  return router;
}
