import type { Middleware } from 'koa';
import { formatAjvErrors } from '../lib/ajv.js';
import { getQueryValidator, type QuerySchemaName } from '../lib/queryAjv.js';
import { parseWireQuery } from './parseWireQuery.js';
import { badRequest } from '../lib/httpError.js';

export type { QuerySchemaName } from '../lib/queryAjv.js';

export function validateQuery(schemaName: QuerySchemaName): Middleware {
  const validate = getQueryValidator(schemaName);

  return async (ctx, next) => {
    const wireQuery = parseWireQuery(ctx.query);
    const valid = validate(wireQuery);
    if (!valid) {
      const formatted = formatAjvErrors(validate.errors);
      throw badRequest(formatted.message, formatted.details);
    }

    await next();
  };
}
