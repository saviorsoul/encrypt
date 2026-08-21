import Router from '@koa/router';
import { API_PATH } from '../config.js';

export function createHealthRouter(): Router {
  const router = new Router({ prefix: API_PATH });

  router.get('/health', (ctx) => {
    ctx.body = { status: 'ok' };
  });

  return router;
}
