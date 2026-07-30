import { describe, expect, it, beforeEach } from 'vitest';
import {
  armPrivateKeySafeStorageSession,
  assertPrivateKeySafeStorageLoad,
  beginPrivateKeySafeStorageSession,
  getPrivateKeySafeStorageSessionState,
  resetPrivateKeySafeStorageSession,
  setPrivateKeySafeStorageAuthState,
  PrivateKeySafeStorageSessionError,
} from '@/crypto/privateKeySafeStorageSession.ts';
import { ELECTRON_KEYCHAIN_LOCKED } from '@/crypto/privateKeySafeStorageSessionErrors.ts';

const TEST_KEY_ID = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const OTHER_KEY_ID = 'BCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF';

beforeEach(() => {
  resetPrivateKeySafeStorageSession();
});

describe('privateKeySafeStorageSession', () => {
  it('starts in boot phase', () => {
    expect(getPrivateKeySafeStorageSessionState()).toEqual({
      phase: 'boot',
      boundKeyId: null,
      isLoggedIn: false,
    });
  });

  it('enters unlock phase when logged in', () => {
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });

    expect(getPrivateKeySafeStorageSessionState()).toEqual({
      phase: 'unlock',
      boundKeyId: TEST_KEY_ID,
      isLoggedIn: true,
    });
  });

  it('locks keychain access after arming', () => {
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });
    armPrivateKeySafeStorageSession(TEST_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState().phase).toBe('locked');
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).toThrow(
      PrivateKeySafeStorageSessionError,
    );
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).toThrow(
      ELECTRON_KEYCHAIN_LOCKED,
    );
  });

  it('resets to boot on logout', () => {
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });
    armPrivateKeySafeStorageSession(TEST_KEY_ID);

    setPrivateKeySafeStorageAuthState({ isLoggedIn: false });

    expect(getPrivateKeySafeStorageSessionState()).toEqual({
      phase: 'boot',
      boundKeyId: null,
      isLoggedIn: false,
    });
  });

  it('does not arm when keyId mismatches', () => {
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });
    armPrivateKeySafeStorageSession(OTHER_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState().phase).toBe('unlock');
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).not.toThrow();
  });

  it('allows beginSession during login', () => {
    setPrivateKeySafeStorageAuthState({ isLoggedIn: true });
    beginPrivateKeySafeStorageSession(TEST_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState()).toEqual({
      phase: 'unlock',
      boundKeyId: TEST_KEY_ID,
      isLoggedIn: true,
    });
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).not.toThrow();
  });
});
