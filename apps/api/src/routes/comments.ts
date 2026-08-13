import Router from '@koa/router';
import {
  handleCreateComment,
  handleListComments,
  type CreateCommentCommand,
} from '@/contexts/feed/index.js';
import { validateBody } from '@/middleware/validateBody.js';
import { verifySignature } from '@/middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '@/middleware/requireAuthenticatedSigner.js';
import {
  normalizeQuery,
  type CommentsRouteContext,
} from '@/middleware/normalizeQuery.js';
import { validateQuery } from '@/middleware/validateQuery.js';

export function createCommentsRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/comments',
    requireAuthenticatedSigner({ jwkField: 'senderPublicJwk' }),
    validateBody('commentPayload'),
    verifySignature('comment-sender'),
    async (ctx) => {
      const command = ctx.request.body as CreateCommentCommand;
      const result = await handleCreateComment(command);
      ctx.status = 201;
      ctx.body = result;
    },
  );

  router.get(
    '/comments',
    validateQuery('commentsQuery'),
    normalizeQuery('commentsQuery'),
    async (ctx: CommentsRouteContext) => {
      const { messageId } = ctx.state.validatedQuery;
      ctx.body = await handleListComments({ messageId });
    },
  );

  return router;
}
