import type { Middleware } from 'koa';
import type { SchemaName } from '../schemas/common.js';
import { formatAjvErrors, getValidator } from '../lib/ajv.js';
import { badRequest } from '../lib/httpError.js';

export type QuerySchemaName = Extract<
  SchemaName,
  | 'recipientKeyIdQuery'
  | 'commentsQuery'
  | 'targetKeyIdQuery'
  | 'requesterKeyIdQuery'
  | 'ownerKeyIdQuery'
>;

export function validateQuery(schemaName: QuerySchemaName): Middleware {
  const validate = getValidator(schemaName);

  return async (ctx, next) => {
    const query = ctx.query;

    if (typeof query !== 'object' || query === null || Array.isArray(query)) {
      throw badRequest('Invalid query parameters.');
    }

    const valid = validate(query);
    if (!valid) {
      const formatted = formatAjvErrors(validate.errors);
      throw badRequest(formatted.message, formatted.details);
    }

    ctx.state.validatedQuery = query;
    await next();
  };
}

declare module 'koa' {
  interface DefaultState {
    validatedQuery?: unknown;
  }
}
