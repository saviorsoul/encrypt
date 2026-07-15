import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MAX_BODY_BYTES } from './constants.js';
import { badRequest } from './lib/httpError.js';
import { authenticate } from './middleware/authenticate.js';
import { authenticateApiUnlessPublic } from './middleware/authenticateApiUnlessPublic.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createFriendshipsRouter } from './routes/friendships.js';
import { createFriendInvitationsRouter } from './routes/friendInvitations.js';
import { createHealthRouter } from './routes/health.js';
import { createCommentsRouter } from './routes/comments.js';
import { createInboxRouter } from './routes/inbox.js';
import { createMessagesRouter } from './routes/messages.js';
import { createSharesRouter } from './routes/shares.js';
import { createAuthRouter } from './routes/auth.js';
import { createUsersRouter } from './routes/users.js';
import { readConfig } from './config.js';

export function createApp(): Koa {
  const app = new Koa();
  const { corsAllowedOrigins } = readConfig();

  app.use(async (ctx, next) => {
    const origin = ctx.get('Origin');
    const isAllowedOrigin = origin.length > 0 && corsAllowedOrigins.has(origin);

    if (isAllowedOrigin) {
      ctx.set('Access-Control-Allow-Origin', origin);
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      ctx.set(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Key-Id, X-Public-Key, X-Time-Slot, X-Nonce, X-Signature',
      );
      ctx.set(
        'Access-Control-Expose-Headers',
        'X-Next-Nonce, X-Next-Nonce-Expires-At',
      );
    }

    if (ctx.method === 'OPTIONS') {
      ctx.status = isAllowedOrigin ? 204 : 403;
      return;
    }

    await next();
  });

  app.use(requestLogger());
  app.use(errorHandler());
  app.use(
    bodyParser({
      enableTypes: ['json'],
      jsonLimit: `${MAX_BODY_BYTES}b`,
      onerror: () => {
        throw badRequest('Invalid JSON body.');
      },
    }),
  );
  app.use(authenticateApiUnlessPublic(authenticate()));

  const healthRouter = createHealthRouter();
  app.use(healthRouter.routes()).use(healthRouter.allowedMethods());

  const authRouter = createAuthRouter();
  app.use(authRouter.routes()).use(authRouter.allowedMethods());

  const usersRouter = createUsersRouter();
  app.use(usersRouter.routes()).use(usersRouter.allowedMethods());

  const messagesRouter = createMessagesRouter();
  app.use(messagesRouter.routes()).use(messagesRouter.allowedMethods());

  const sharesRouter = createSharesRouter();
  app.use(sharesRouter.routes()).use(sharesRouter.allowedMethods());

  const inboxRouter = createInboxRouter();
  app.use(inboxRouter.routes()).use(inboxRouter.allowedMethods());

  const commentsRouter = createCommentsRouter();
  app.use(commentsRouter.routes()).use(commentsRouter.allowedMethods());

  const friendshipsRouter = createFriendshipsRouter();
  app.use(friendshipsRouter.routes()).use(friendshipsRouter.allowedMethods());

  const friendInvitationsRouter = createFriendInvitationsRouter();
  app
    .use(friendInvitationsRouter.routes())
    .use(friendInvitationsRouter.allowedMethods());

  return app;
}
