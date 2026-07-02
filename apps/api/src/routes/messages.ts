import Router from '@koa/router';
import type { CreateMessageRequest } from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';
import { verifySignature } from '../middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '../middleware/requireAuthenticatedSigner.js';
import { createMessage } from '../services/createMessage.js';

export function createMessagesRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/messages',
    requireAuthenticatedSigner({ jwkField: 'senderPublicJwk' }),
    validateBody('createMessageRequest'),
    verifySignature('sender'),
    async (ctx) => {
      const body = ctx.request.body as CreateMessageRequest;
      const result = await createMessage(body);
      ctx.status = 201;
      ctx.body = result;
    },
  );

  return router;
}
