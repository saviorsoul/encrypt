import Router from '@koa/router';
import type {
  AuthChallengeRequest,
  AuthChallengeResponse,
} from '@/schemas/common.js';
import { validateBody } from '@/middleware/validateBody.js';
import { handleGetOrMintAuthNonce } from '@/contexts/auth/index.js';

export function createAuthRouter(): Router {
  const router = new Router({ prefix: '/api/auth' });

  router.post(
    '/challenge',
    validateBody('authChallengeRequest'),
    async (ctx) => {
      const { keyId } = ctx.request.body as AuthChallengeRequest;
      const { nonce, expiresAtMs } = await handleGetOrMintAuthNonce({ keyId });
      ctx.status = 201;
      const body: AuthChallengeResponse = { nonce, expiresAt: expiresAtMs };
      ctx.body = body;
    },
  );

  return router;
}
