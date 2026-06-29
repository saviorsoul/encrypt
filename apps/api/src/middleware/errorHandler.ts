import type { Middleware } from 'koa';
import { isHttpError } from '../lib/httpError.js';
import { logUnhandledError } from './requestLogger.js';

export function errorHandler(): Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      if (isHttpError(error)) {
        ctx.status = error.status;
        ctx.body = { error: error.message };
        return;
      }

      if (error instanceof SyntaxError) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid JSON body.' };
        return;
      }

      logUnhandledError(error, ctx);
      ctx.status = 500;
      ctx.body = { error: 'Internal server error.' };
    }
  };
}
