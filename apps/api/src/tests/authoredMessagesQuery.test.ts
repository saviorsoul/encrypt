import { describe, expect, it } from 'vitest';
import { getQueryValidator } from '@/lib/queryAjv.js';
import { MAX_INBOX_LIMIT } from '@/constants.js';

describe('authoredMessagesQuery wire schema', () => {
  const validate = getQueryValidator('authoredMessagesQuery');

  it('accepts an empty query', () => {
    expect(validate({})).toBe(true);
  });

  it('accepts valid wire values', () => {
    expect(
      validate({
        limit: '15',
        cursor: '550e8400-e29b-41d4-a716-446655440000',
        sort: 'date',
        order: 'desc',
      }),
    ).toBe(true);
  });

  it('rejects unknown query parameters', () => {
    expect(validate({ foo: 'bar' })).toBe(false);
  });

  it('rejects limit above maximum', () => {
    expect(validate({ limit: String(MAX_INBOX_LIMIT + 1) })).toBe(false);
  });
});
