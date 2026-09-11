import { describe, expect, it } from 'vitest';
import { getQueryValidator } from '@/lib/queryAjv.js';
import { MAX_INBOX_LIMIT } from '@/constants.js';

describe('inboxQuery wire schema', () => {
  const validate = getQueryValidator('inboxQuery');

  it('accepts an empty query', () => {
    expect(validate({})).toBe(true);
  });

  it('accepts valid wire values', () => {
    expect(
      validate({
        limit: '15',
        cursorSortAt: '2026-09-10T15:00:00.000Z',
        cursorThreadId: '550e8400-e29b-41d4-a716-446655440000',
        sort: 'shareTime',
        order: 'asc',
      }),
    ).toBe(true);
  });

  it('accepts all feed sort modes', () => {
    expect(validate({ sort: 'originalDate' })).toBe(true);
    expect(validate({ sort: 'lastComment' })).toBe(true);
    expect(validate({ sort: 'date' })).toBe(true);
  });

  it('rejects unknown query parameters', () => {
    expect(validate({ foo: 'bar' })).toBe(false);
  });

  it('rejects invalid sort', () => {
    expect(validate({ sort: 'title' })).toBe(false);
  });

  it('rejects invalid order', () => {
    expect(validate({ order: 'sideways' })).toBe(false);
  });

  it('rejects limit below minimum', () => {
    expect(validate({ limit: '0' })).toBe(false);
  });

  it('rejects limit above maximum', () => {
    expect(validate({ limit: String(MAX_INBOX_LIMIT + 1) })).toBe(false);
  });

  it('rejects invalid cursor fields', () => {
    expect(validate({ cursorSortAt: 'not-a-date' })).toBe(false);
    expect(validate({ cursorThreadId: 'not-a-uuid' })).toBe(false);
  });

  it('rejects partial cursor params', () => {
    expect(
      validate({
        cursorSortAt: '2026-09-10T15:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      validate({
        cursorThreadId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toBe(false);
  });

  it('accepts ascending and descending aliases before normalization', () => {
    expect(validate({ order: 'ascending' })).toBe(true);
    expect(validate({ order: 'descending' })).toBe(true);
  });
});
