import Router from '@koa/router';
import type {
  DeleteFriendshipRequest,
  FriendshipPairRequest,
} from '../schemas/common.js';
import { validateBody } from '../middleware/validateBody.js';
import { validateQuery } from '../middleware/validateQuery.js';
import type {
  OwnerKeyIdQuery,
  RequesterKeyIdQuery,
  TargetKeyIdQuery,
} from '../schemas/query.js';
import {
  acceptFriendshipRequest,
  createFriendshipRequest,
  deleteFriendship,
  listFriendships,
  listIncomingFriendshipRequests,
  listOutgoingFriendshipRequests,
  rejectFriendshipRequest,
} from '../services/friendships.js';

export function createFriendshipsRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post(
    '/friendships/request',
    validateBody('friendshipPairRequest'),
    async (ctx) => {
      const body = ctx.request.body as FriendshipPairRequest;
      const result = await createFriendshipRequest(body);
      ctx.status = result.status === 'accepted' ? 200 : 201;
      ctx.body = result;
    },
  );

  router.get(
    '/friendships/requests/incoming',
    validateQuery('targetKeyIdQuery'),
    async (ctx) => {
      const { targetKeyId } = ctx.state.validatedQuery as TargetKeyIdQuery;
      ctx.body = await listIncomingFriendshipRequests(targetKeyId);
    },
  );

  router.get(
    '/friendships/requests/outgoing',
    validateQuery('requesterKeyIdQuery'),
    async (ctx) => {
      const { requesterKeyId } = ctx.state
        .validatedQuery as RequesterKeyIdQuery;
      ctx.body = await listOutgoingFriendshipRequests(requesterKeyId);
    },
  );

  router.post(
    '/friendships/requests/accept',
    validateBody('friendshipPairRequest'),
    async (ctx) => {
      const body = ctx.request.body as FriendshipPairRequest;
      ctx.body = await acceptFriendshipRequest(body);
    },
  );

  router.post(
    '/friendships/requests/reject',
    validateBody('friendshipPairRequest'),
    async (ctx) => {
      const body = ctx.request.body as FriendshipPairRequest;
      ctx.body = await rejectFriendshipRequest(body);
    },
  );

  router.get('/friendships', validateQuery('ownerKeyIdQuery'), async (ctx) => {
    const { ownerKeyId } = ctx.state.validatedQuery as OwnerKeyIdQuery;
    ctx.body = await listFriendships(ownerKeyId);
  });

  router.delete(
    '/friendships',
    validateBody('deleteFriendshipRequest'),
    async (ctx) => {
      const body = ctx.request.body as DeleteFriendshipRequest;
      await deleteFriendship(body);
      ctx.status = 204;
    },
  );

  return router;
}
