import Router from '@koa/router';
import { handleListUsers } from '@/contexts/users/index.js';

export function createUsersRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/users', async (ctx) => {
    const users = await handleListUsers();
    ctx.body = users;
  });

  return router;
}
