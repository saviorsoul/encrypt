import { describe, expect, it } from 'vitest';
import {
  FeedLabBridgeKeyMismatchError,
  formatKeyIdPreview,
  isFeedLabBridgeKeyMismatchError,
} from '@/utils/feedLabBridgeKeyMismatch.ts';

describe('feedLabBridgeKeyMismatch', () => {
  it('identifies key mismatch errors', () => {
    const error = new FeedLabBridgeKeyMismatchError('expected-key', 'actual-key');
    expect(isFeedLabBridgeKeyMismatchError(error)).toBe(true);
    expect(error.expectedKeyId).toBe('expected-key');
    expect(error.actualKeyId).toBe('actual-key');
  });

  it('formats long key ids for display', () => {
    const keyId = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    expect(formatKeyIdPreview(keyId)).toBe('abcdefgh…DEFG');
  });
});
