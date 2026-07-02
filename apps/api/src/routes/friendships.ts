import Router from '@koa/router';
import type {
  DeleteFriendshipBody,
  FriendshipRequesterBody,
  FriendshipTargetBody,
} from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';
import { unauthorized } from '../lib/httpError.js';
import {
  acceptFriendshipRequest,
  createFriendshipRequest,
  deleteFriendship,
  listFriendships,
  listFriendshipRequests,
  rejectFriendshipRequest,
} from '../services/friendships.js';

function readAuthenticatedKeyId(ctx: {
  state: { authenticatedKeyId?: string };
}): string {
  const keyId = ctx.state.authenticatedKeyId;
  if (!keyId) {
    throw unauthorized('Authentication is required.');
  }
  return keyId;
}

export function createFriendshipsRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/friendships/request',
    validateBody('friendshipTargetBody'),
    async (ctx) => {
      const requesterKeyId = readAuthenticatedKeyId(ctx);
      const { targetKeyId } = ctx.request.body as FriendshipTargetBody;
      const result = await createFriendshipRequest({
        requesterKeyId,
        targetKeyId,
      });
      ctx.status = result.status === 'accepted' ? 200 : 201;
      ctx.body = result;
    },
  );

  router.get('/friendships/requests', async (ctx) => {
    const keyId = readAuthenticatedKeyId(ctx);
    ctx.body = await listFriendshipRequests(keyId);
  });

  router.post(
    '/friendships/requests/accept',
    validateBody('friendshipRequesterBody'),
    async (ctx) => {
      const targetKeyId = readAuthenticatedKeyId(ctx);
      const { requesterKeyId } = ctx.request.body as FriendshipRequesterBody;
      ctx.body = await acceptFriendshipRequest({ requesterKeyId, targetKeyId });
    },
  );

  router.post(
    '/friendships/requests/reject',
    validateBody('friendshipRequesterBody'),
    async (ctx) => {
      const targetKeyId = readAuthenticatedKeyId(ctx);
      const { requesterKeyId } = ctx.request.body as FriendshipRequesterBody;
      ctx.body = await rejectFriendshipRequest({ requesterKeyId, targetKeyId });
    },
  );

  router.get('/friendships', async (ctx) => {
    const ownerKeyId = readAuthenticatedKeyId(ctx);
    ctx.body = await listFriendships(ownerKeyId);
  });

  router.delete(
    '/friendships',
    validateBody('deleteFriendshipBody'),
    async (ctx) => {
      const ownerKeyId = readAuthenticatedKeyId(ctx);
      const { friendKeyId } = ctx.request.body as DeleteFriendshipBody;
      await deleteFriendship({ ownerKeyId, friendKeyId });
      ctx.status = 204;
    },
  );

  return router;
}
