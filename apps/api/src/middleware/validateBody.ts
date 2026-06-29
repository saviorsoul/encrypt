import type { Middleware } from 'koa';
import type { SchemaName } from '../schemas/common.js';
import { formatAjvErrors, getValidator } from '../lib/ajv.js';
import { badRequest } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

export function validateBody(schemaName: SchemaName): Middleware {
  const validate = getValidator(schemaName);

  return async (ctx, next) => {
    const body = ctx.request.body;
    logger.debug(
      { method: ctx.method, path: ctx.path, schema: schemaName },
      'validating request body',
    );

    if (body === undefined || body === null) {
      logger.debug(
        {
          method: ctx.method,
          path: ctx.path,
          schema: schemaName,
          outcome: 'missing',
        },
        'request body validation failed',
      );
      throw badRequest('Request body is required.');
    }

    if (typeof body !== 'object' || Array.isArray(body)) {
      logger.debug(
        {
          method: ctx.method,
          path: ctx.path,
          schema: schemaName,
          outcome: 'invalid_type',
          bodyType: Array.isArray(body) ? 'array' : typeof body,
        },
        'request body validation failed',
      );
      throw badRequest('Request body must be a JSON object.');
    }

    const valid = validate(body);
    if (!valid) {
      logger.debug(
        {
          method: ctx.method,
          path: ctx.path,
          schema: schemaName,
          outcome: 'schema_mismatch',
          errors: validate.errors,
        },
        'request body validation failed',
      );
      throw badRequest(formatAjvErrors(validate.errors));
    }

    logger.debug(
      {
        method: ctx.method,
        path: ctx.path,
        schema: schemaName,
        outcome: 'valid',
      },
      'request body validation passed',
    );

    await next();
  };
}
