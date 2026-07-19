import Router from '@koa/router';
import {
  handleCreateShare,
  type CreateShareCommand,
} from '@/contexts/feed/index.js';
import { validateBody } from '@/middleware/validateBody.js';
import { verifySignature } from '@/middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '@/middleware/requireAuthenticatedSigner.js';

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
      const command = ctx.request.body as CreateShareCommand;
      const result = await handleCreateShare(command);
      ctx.status = 201;
      ctx.body = result;
    },
  );

  return router;
}
