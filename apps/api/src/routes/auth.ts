import Router from '@koa/router';
import type { AuthChallengeRequest } from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';
import { mintAuthNonce } from '../services/authNonce.js';

export function createAuthRouter(): Router {
  const router = new Router({ prefix: '/api/auth' });

  router.post(
    '/challenge',
    validateBody('authChallengeRequest'),
    async (ctx) => {
      const { keyId } = ctx.request.body as AuthChallengeRequest;
      const nonce = await mintAuthNonce(keyId);
      ctx.status = 201;
      ctx.body = { nonce };
    },
  );

  return router;
}
