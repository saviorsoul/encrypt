import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MAX_BODY_BYTES } from './constants.js';
import { badRequest } from './lib/httpError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createHealthRouter } from './routes/health.js';
import { createCommentsRouter } from './routes/comments.js';
import { createMessagesRouter } from './routes/messages.js';
import { createSharesRouter } from './routes/shares.js';

export function createApp(): Koa {
  const app = new Koa();

  app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type');
    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
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

  const healthRouter = createHealthRouter();
  app.use(healthRouter.routes()).use(healthRouter.allowedMethods());

  const messagesRouter = createMessagesRouter();
  app.use(messagesRouter.routes()).use(messagesRouter.allowedMethods());

  const sharesRouter = createSharesRouter();
  app.use(sharesRouter.routes()).use(sharesRouter.allowedMethods());

  const commentsRouter = createCommentsRouter();
  app.use(commentsRouter.routes()).use(commentsRouter.allowedMethods());

  return app;
}
