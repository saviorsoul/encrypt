import { describe, expect, it } from 'vitest';
import { messageHasComments } from '@encrypt/core/utils/feedMessageComments';

describe('messageHasComments', () => {
  it('returns false when lastCommentAt is missing or null', () => {
    expect(messageHasComments({})).toBe(false);
    expect(messageHasComments({ lastCommentAt: null })).toBe(false);
  });

  it('returns true when lastCommentAt is set', () => {
    expect(messageHasComments({ lastCommentAt: Date.now() })).toBe(true);
  });
});
