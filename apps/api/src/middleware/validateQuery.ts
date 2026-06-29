import type { Middleware } from 'koa';
import type { ZodType } from 'zod';
import { badRequest } from '../lib/httpError.js';

export function validateQuery<T>(schema: ZodType<T>): Middleware {
  return async (ctx, next) => {
    const parsed = schema.safeParse(ctx.query);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw badRequest(message);
    }

    ctx.state.validatedQuery = parsed.data;
    await next();
  };
}

declare module 'koa' {
  interface DefaultState {
    validatedQuery?: unknown;
  }
}
