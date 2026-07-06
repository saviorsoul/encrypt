import Router from '@koa/router';
import { listUsers } from '../db/users.js';

export function createUsersRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/users', async (ctx) => {
    const users = await listUsers();
    ctx.body = users;
  });

  return router;
}
