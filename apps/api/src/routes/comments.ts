import Router from '@koa/router';
import {
  handleCreateComment,
  handleListComments,
  type CreateCommentCommand,
} from '@/contexts/feed/index.js';
import { validateBody } from '@/middleware/validateBody.js';
import { verifySignature } from '@/middleware/verifySignature.js';
import { requireAuthenticatedSigner } from '@/middleware/requireAuthenticatedSigner.js';
import { validateQuery } from '@/middleware/validateQuery.js';
import type { CommentsQuery } from '@/schemas/query.js';

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

  router.get('/comments', validateQuery('commentsQuery'), async (ctx) => {
    const { messageId } = ctx.state.validatedQuery as CommentsQuery;
    ctx.body = await handleListComments({ messageId });
  });

  return router;
}
