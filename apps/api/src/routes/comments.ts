import { randomUUID } from 'node:crypto';
import Router from '@koa/router';
import { validateBody } from '../middleware/validateBody.js';

/** Stub route for exercising commentPayload schema validation. */
export function createCommentsRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post('/comments', validateBody('commentPayload'), (ctx) => {
    ctx.status = 201;
    ctx.body = { id: randomUUID() };
  });

  return router;
}
