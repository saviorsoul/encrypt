import Router from '@koa/router';
import type {
  DeleteFriendshipBody,
  FriendshipRequesterBody,
  FriendshipTargetBody,
} from '@/schemas/common.js';
import { validateBody } from '@/middleware/validateBody.js';
import { unauthorized } from '@/lib/httpError.js';
import {
  handleAcceptFriendshipRequest,
  handleCreateFriendshipRequest,
  handleDeleteFriendship,
  handleListFriendshipRequests,
  handleListFriendships,
  handleRejectFriendshipRequest,
} from '@/contexts/friendships/index.js';

function readAuthenticatedKeyId(ctx: {
  state: { authenticatedKeyId?: string };
}): string {
  const keyId = ctx.state.authenticatedKeyId;
  if (!keyId) {
    throw unauthorized('Authentication is required.');
  }
  return keyId;
}

function readAuthenticatedPublicKey(ctx: {
  state: { authenticatedPublicKey?: { x: string; y: string } };
}): { x: string; y: string } {
  const publicKey = ctx.state.authenticatedPublicKey;
  if (!publicKey) {
    throw unauthorized('Authentication is required.');
  }
  return publicKey;
}

export function createFriendshipsRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/friendships/request',
    validateBody('friendshipTargetBody'),
    async (ctx) => {
      const requesterKeyId = readAuthenticatedKeyId(ctx);
      const requesterPublicKey = readAuthenticatedPublicKey(ctx);
      const { targetKeyId, invitationToken } = ctx.request
        .body as FriendshipTargetBody;
      const result = await handleCreateFriendshipRequest({
        requesterKeyId,
        requesterPublicKey,
        targetKeyId,
        invitationToken,
      });
      ctx.status = result.status === 'accepted' ? 200 : 201;
      ctx.body = result;
    },
  );

  router.get('/friendships/requests', async (ctx) => {
    const keyId = readAuthenticatedKeyId(ctx);
    const publicKey = readAuthenticatedPublicKey(ctx);
    ctx.body = await handleListFriendshipRequests({ keyId, publicKey });
  });

  router.post(
    '/friendships/requests/accept',
    validateBody('friendshipRequesterBody'),
    async (ctx) => {
      const targetKeyId = readAuthenticatedKeyId(ctx);
      const targetPublicKey = readAuthenticatedPublicKey(ctx);
      const { requesterKeyId } = ctx.request.body as FriendshipRequesterBody;
      ctx.body = await handleAcceptFriendshipRequest({
        requesterKeyId,
        targetKeyId,
        targetPublicKey,
      });
    },
  );

  router.post(
    '/friendships/requests/reject',
    validateBody('friendshipRequesterBody'),
    async (ctx) => {
      const targetKeyId = readAuthenticatedKeyId(ctx);
      const targetPublicKey = readAuthenticatedPublicKey(ctx);
      const { requesterKeyId } = ctx.request.body as FriendshipRequesterBody;
      ctx.body = await handleRejectFriendshipRequest({
        requesterKeyId,
        targetKeyId,
        targetPublicKey,
      });
    },
  );

  router.get('/friendships', async (ctx) => {
    const ownerKeyId = readAuthenticatedKeyId(ctx);
    ctx.body = await handleListFriendships({ ownerKeyId });
  });

  router.delete(
    '/friendships',
    validateBody('deleteFriendshipBody'),
    async (ctx) => {
      const ownerKeyId = readAuthenticatedKeyId(ctx);
      const { friendKeyId } = ctx.request.body as DeleteFriendshipBody;
      await handleDeleteFriendship({ ownerKeyId, friendKeyId });
      ctx.status = 204;
    },
  );

  return router;
}
