import Router from '@koa/router';

export function createHealthRouter(): Router {
  const router = new Router();

  router.get('/health', (ctx) => {
    ctx.body = { status: 'ok' };
  });

  return router;
}
