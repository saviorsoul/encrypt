import type { Middleware } from 'koa';
import { readConfig } from '../config.js';
import { isHttpError } from '../lib/httpError.js';
import { logUnhandledError } from './requestLogger.js';

export function errorHandler(): Middleware {
  const { isDev } = readConfig();

  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      if (isHttpError(error)) {
        ctx.status = error.status;
        ctx.body = {
          error: error.message,
          ...(isDev && error.details !== undefined
            ? { validationErrors: error.details }
            : {}),
        };
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
