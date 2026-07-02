import Router from '@koa/router';
import type { CreateShareRequest } from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';
import { verifySignature } from '../middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '../middleware/requireAuthenticatedSigner.js';
import { createShare } from '../services/createShare.js';

export function createSharesRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/shares',
    requireAuthenticatedSigner({
      bodyPath: 'share',
      jwkField: 'sharerPublicJwk',
    }),
    validateBody('createShareRequest'),
    verifySignature('sharer', { bodyPath: 'share' }),
    async (ctx) => {
      const body = ctx.request.body as CreateShareRequest;
      const result = await createShare(body);
      ctx.status = 201;
      ctx.body = result;
    },
  );

  return router;
}
