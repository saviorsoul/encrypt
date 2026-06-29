import type { Middleware } from 'koa';
import { isHttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

function requestOutcome(
  status: number,
): 'success' | 'client_error' | 'server_error' {
  if (status >= 500) {
    return 'server_error';
  }
  if (status >= 400) {
    return 'client_error';
  }
  return 'success';
}

function responseErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  const message = (body as { error?: unknown }).error;
  return typeof message === 'string' && message ? message : undefined;
}

export function requestLogger(): Middleware {
  return async (ctx, next) => {
    const start = process.hrtime.bigint();

    try {
      await next();
    } finally {
      const durationMs =
        Math.round(
          (Number(process.hrtime.bigint() - start) / 1_000_000) * 100,
        ) / 100;
      const status = ctx.status || 404;
      const outcome = requestOutcome(status);
      const errorMessage = responseErrorMessage(ctx.body);
      const payload = {
        method: ctx.method,
        path: ctx.path,
        url: ctx.url,
        query: ctx.query,
        status,
        durationMs,
        outcome,
        ...(errorMessage ? { error: errorMessage } : {}),
      };

      if (outcome === 'server_error') {
        logger.error(payload, 'request failed');
      } else if (outcome === 'client_error') {
        logger.warn(payload, 'request completed');
      } else {
        logger.info(payload, 'request completed');
      }
    }
  };
}

export function logUnhandledError(
  error: unknown,
  ctx: { method: string; path: string },
): void {
  const payload = {
    method: ctx.method,
    path: ctx.path,
    err:
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error,
  };

  if (isHttpError(error)) {
    logger.warn({ ...payload, status: error.status }, 'request rejected');
    return;
  }

  logger.error(payload, 'unhandled request error');
}
