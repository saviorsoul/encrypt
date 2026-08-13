import { badRequest } from '../lib/httpError.js';

export function parseWireQuery(query: unknown): Record<string, string> {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw badRequest('Invalid query parameters.');
  }

  const wireQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      throw badRequest(`Invalid query parameter: ${key}.`);
    }
    if (value === undefined || value === '') {
      continue;
    }
    wireQuery[key] = String(value);
  }

  return wireQuery;
}
