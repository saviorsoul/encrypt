import Router from '@koa/router';
import { API_PATH } from '@/config.js';
import {
  handleCreateShare,
  handleCreateShareBatch,
  type CreateShareCommand,
} from '@/contexts/feed/index.js';
import type { CreateShareBatchRequest } from '@/schemas/common.js';
import { validateBody } from '@/middleware/validateBody.js';
import { verifySignature } from '@/middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '@/middleware/requireAuthenticatedSigner.js';
import { requireBatchShareSigner } from '@/middleware/requireBatchShareSigner.js';

export function createSharesRouter(): Router {
  const router = new Router({ prefix: API_PATH });

  router.post(
    '/shares/batch',
    validateBody('createShareBatchRequest'),
    requireBatchShareSigner(),
    async (ctx) => {
      const body = ctx.request.body as CreateShareBatchRequest;
      const result = await handleCreateShareBatch({
        shares: body.shares,
        senderKeyId: ctx.state.authenticatedKeyId!,
      });
      const createdCount = result.results.filter(
        (entry) => 'id' in entry,
      ).length;
      ctx.status = createdCount > 0 ? 201 : 200;
      ctx.body = result;
    },
  );

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
      const result = await handleCreateShare({
        ...command,
        senderKeyId: ctx.state.authenticatedKeyId!,
      });
      if ('recipientsAlreadyHadAccess' in result) {
        ctx.status = 200;
      } else {
        ctx.status = 201;
      }
      ctx.body = result;
    },
  );

  return router;
}
