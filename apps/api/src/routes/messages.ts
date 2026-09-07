import Router from '@koa/router';
import { API_PATH } from '@/config.js';
import {
  handleCreateMessage,
  handleListAuthoredMessages,
  type CreateMessageCommand,
} from '@/contexts/feed/index.js';
import { validateBody } from '@/middleware/validateBody.js';
import { verifySignature } from '@/middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '@/middleware/requireAuthenticatedSigner.js';
import {
  normalizeQuery,
  type InboxRouteContext,
} from '@/middleware/normalizeQuery.js';
import { validateQuery } from '@/middleware/validateQuery.js';
import { unauthorized } from '@/lib/httpError.js';

export function createMessagesRouter(): Router {
  const router = new Router({ prefix: API_PATH });

  router.post(
    '/messages',
    requireAuthenticatedSigner({ jwkField: 'senderPublicJwk' }),
    validateBody('createMessageRequest'),
    verifySignature('sender'),
    async (ctx) => {
      const command = ctx.request.body as CreateMessageCommand;
      const result = await handleCreateMessage({
        ...command,
        senderKeyId: ctx.state.authenticatedKeyId!,
      });
      ctx.status = 201;
      ctx.body = result;
    },
  );

  router.get(
    '/messages/authored',
    validateQuery('authoredMessagesQuery'),
    normalizeQuery('authoredMessagesQuery'),
    async (ctx: InboxRouteContext) => {
      const authorKeyId = ctx.state.authenticatedKeyId;
      if (!authorKeyId) {
        throw unauthorized('Authentication is required.');
      }

      const { validatedQuery } = ctx.state;

      ctx.body = await handleListAuthoredMessages({
        authorKeyId,
        ...validatedQuery,
      });
    },
  );

  return router;
}
