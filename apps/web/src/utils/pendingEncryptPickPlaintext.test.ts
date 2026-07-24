import { describe, expect, it, beforeEach } from 'vitest';
import {
  PENDING_ENCRYPT_PICK_PLAINTEXT_KEY,
  readPendingEncryptPickPlaintext,
  writePendingEncryptPickPlaintext,
} from '@/utils/pendingEncryptPickPlaintext.ts';

describe('pendingEncryptPickPlaintext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists and reads queued plaintext', () => {
    writePendingEncryptPickPlaintext('hello');
    expect(sessionStorage.getItem(PENDING_ENCRYPT_PICK_PLAINTEXT_KEY)).toBe(
      'hello',
    );
    expect(readPendingEncryptPickPlaintext()).toBe('hello');
  });

  it('clears queued plaintext', () => {
    writePendingEncryptPickPlaintext('hello');
    writePendingEncryptPickPlaintext(null);
    expect(readPendingEncryptPickPlaintext()).toBeNull();
  });
});
