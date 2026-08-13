import { describe, expect, it } from 'vitest';
import { getQueryNormalizer } from '@/lib/queryAjv.js';
import { DEFAULT_INBOX_LIMIT } from '@/constants.js';

describe('inboxQuery normalization', () => {
  const normalize = getQueryNormalizer('inboxQuery');

  it('applies defaults when query is empty', () => {
    const query: Record<string, unknown> = {};
    expect(normalize(query)).toBe(true);
    expect(query).toEqual({
      limit: DEFAULT_INBOX_LIMIT,
      sort: 'date',
      order: 'desc',
    });
  });

  it('coerces limit from string', () => {
    const query = { limit: '15', sort: 'date', order: 'asc' };
    expect(normalize(query)).toBe(true);
    expect(query.limit).toBe(15);
  });

  it('normalizes ascending and descending aliases', () => {
    const ascendingQuery: Record<string, unknown> = { order: 'ascending' };
    expect(normalize(ascendingQuery)).toBe(true);
    expect(ascendingQuery.order).toBe('asc');

    const descendingQuery: Record<string, unknown> = { order: 'descending' };
    expect(normalize(descendingQuery)).toBe(true);
    expect(descendingQuery.order).toBe('desc');
  });
});
