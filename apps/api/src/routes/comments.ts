import Router from '@koa/router';
import type { CommentPayloadBody } from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';
import { verifySignature } from '../middleware/verifySignature.js';
import { validateQuery } from '../middleware/validateQuery.js';
import type { CommentsQuery } from '../schemas/query.js';
import { createComment, listComments } from '../services/comments.js';

export function createCommentsRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/comments',
    validateBody('commentPayload'),
    verifySignature('comment-sender'),
    async (ctx) => {
      const body = ctx.request.body as CommentPayloadBody & {
        messageId: string;
      };
      const result = await createComment(body);
      ctx.status = 201;
      ctx.body = result;
    },
  );

  router.get('/comments', validateQuery('commentsQuery'), async (ctx) => {
    const { messageId } = ctx.state.validatedQuery as CommentsQuery;
    ctx.body = await listComments(messageId);
  });

  return router;
}
