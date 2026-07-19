import Router from '@koa/router';
import {
  handleCreateMessage,
  type CreateMessageCommand,
} from '@/contexts/feed/index.js';
import { validateBody } from '@/middleware/validateBody.js';
import { verifySignature } from '@/middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '@/middleware/requireAuthenticatedSigner.js';

export function createMessagesRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/messages',
    requireAuthenticatedSigner({ jwkField: 'senderPublicJwk' }),
    validateBody('createMessageRequest'),
    verifySignature('sender'),
    async (ctx) => {
      const command = ctx.request.body as CreateMessageCommand;
      const result = await handleCreateMessage(command);
      ctx.status = 201;
      ctx.body = result;
    },
  );

  return router;
}
