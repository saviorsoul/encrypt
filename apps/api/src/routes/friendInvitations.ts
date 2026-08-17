import Router from '@koa/router';
import { validateBody } from '@/middleware/validateBody.js';
import { unauthorized } from '@/lib/httpError.js';
import {
  API_PATH,
  FRIEND_INVITATION_ACCEPT_SUFFIX,
  FRIEND_INVITATIONS_PATH,
} from '@/config.js';
import {
  handleAcceptFriendInvitation,
  handleCreateFriendInvitation,
  handleGetFriendInvitation,
  handleListFriendInvitations,
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

export function createFriendInvitationsRouter(): Router {
  const router = new Router({ prefix: API_PATH });

  router.post(
    FRIEND_INVITATIONS_PATH,
    validateBody('createFriendInvitationBody'),
    async (ctx) => {
      const inviterKeyId = readAuthenticatedKeyId(ctx);
      const inviterPublicKey = readAuthenticatedPublicKey(ctx);
      const invitation = await handleCreateFriendInvitation({
        inviterKeyId,
        inviterPublicKey,
      });
      ctx.status = 201;
      ctx.body = invitation;
    },
  );

  router.get(FRIEND_INVITATIONS_PATH, async (ctx) => {
    const inviterKeyId = readAuthenticatedKeyId(ctx);
    ctx.body = await handleListFriendInvitations({ inviterKeyId });
  });

  router.get(`${FRIEND_INVITATIONS_PATH}/:token`, async (ctx) => {
    const token = ctx.params.token;
    ctx.body = await handleGetFriendInvitation({ token });
  });

  router.post(
    `${FRIEND_INVITATIONS_PATH}/:token/${FRIEND_INVITATION_ACCEPT_SUFFIX}`,
    validateBody('acceptFriendInvitationBody'),
    async (ctx) => {
      const inviteeKeyId = readAuthenticatedKeyId(ctx);
      const inviteePublicKey = readAuthenticatedPublicKey(ctx);
      const token = ctx.params.token;
      ctx.body = await handleAcceptFriendInvitation({
        token,
        inviteeKeyId,
        inviteePublicKey,
      });
    },
  );

  return router;
}
