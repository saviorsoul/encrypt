import type { DefaultState, Middleware, ParameterizedContext } from 'koa';
import { formatAjvErrors } from '../lib/ajv.js';
import { getQueryNormalizer, type QuerySchemaName } from '../lib/queryAjv.js';
import type {
  CommentsQuery,
  InboxQuery,
  ValidatedQueryMap,
} from '../schemas/query.js';
import { parseWireQuery } from './parseWireQuery.js';
import { badRequest } from '../lib/httpError.js';

export type WithValidatedQuery<TQuery> = DefaultState & {
  validatedQuery: TQuery;
};

export type InboxRouteContext = ParameterizedContext<
  WithValidatedQuery<InboxQuery>
>;
export type CommentsRouteContext = ParameterizedContext<
  WithValidatedQuery<CommentsQuery>
>;

export function normalizeQuery<T extends QuerySchemaName>(
  schemaName: T,
): Middleware<WithValidatedQuery<ValidatedQueryMap[T]>> {
  const normalize = getQueryNormalizer(schemaName);

  return async (
    ctx: ParameterizedContext<WithValidatedQuery<ValidatedQueryMap[T]>>,
    next,
  ) => {
    const query = { ...parseWireQuery(ctx.query) };
    const valid = normalize(query);
    if (!valid) {
      const formatted = formatAjvErrors(normalize.errors);
      throw badRequest(formatted.message, formatted.details);
    }

    ctx.state.validatedQuery = query as ValidatedQueryMap[T];
    await next();
  };
}
