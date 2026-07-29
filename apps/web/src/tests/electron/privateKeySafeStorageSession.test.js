import { beforeEach, describe, expect, it } from 'vitest';
import {
  PrivateKeySafeStorageSessionError,
  assertPrivateKeySafeStorageHas,
  assertPrivateKeySafeStorageLoad,
  assertPrivateKeySafeStoragePickFromDialog,
  assertPrivateKeySafeStorageStore,
  armPrivateKeySafeStorageSession,
  beginPrivateKeySafeStorageSession,
  getPrivateKeySafeStorageSessionState,
  resetPrivateKeySafeStorageSession,
  setPrivateKeySafeStorageAuthState,
} from '../../../electron/privateKeySafeStorageSession.js';

const TEST_KEY_ID = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
const OTHER_KEY_ID = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

beforeEach(() => {
  resetPrivateKeySafeStorageSession();
});

describe('privateKeySafeStorageSession', () => {
  it('starts in boot with no bound key', () => {
    expect(getPrivateKeySafeStorageSessionState()).toEqual({
      phase: 'boot',
      boundKeyId: null,
      isLoggedIn: false,
    });
  });

  it('enters unlock when the user signs in and binds keyId from tray sync', () => {
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

  it('locks after the renderer arms the session for the bound key', () => {
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });

    armPrivateKeySafeStorageSession(TEST_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState().phase).toBe('locked');
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).toThrow(
      PrivateKeySafeStorageSessionError,
    );
  });

  it('rejects load/store for a different key id during unlock', () => {
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });

    expect(() => assertPrivateKeySafeStorageLoad(OTHER_KEY_ID)).toThrow(
      'Private key operation is not allowed for this account.',
    );
    expect(() => assertPrivateKeySafeStorageStore(OTHER_KEY_ID)).toThrow(
      'Private key operation is not allowed for this account.',
    );
  });

  it('rejects keychain operations in boot before sign-in', () => {
    expect(() => assertPrivateKeySafeStorageHas(TEST_KEY_ID)).toThrow(
      'Private key keychain is not available until you sign in.',
    );
    expect(() => assertPrivateKeySafeStoragePickFromDialog()).toThrow(
      'Private key keychain is not available until you sign in.',
    );
  });

  it('allows begin-session to bind keyId after login', () => {
    setPrivateKeySafeStorageAuthState({ isLoggedIn: true });
    beginPrivateKeySafeStorageSession(TEST_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState()).toEqual({
      phase: 'unlock',
      boundKeyId: TEST_KEY_ID,
      isLoggedIn: true,
    });
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).not.toThrow();
  });

  it('rejects begin-session when logged out', () => {
    expect(() => beginPrivateKeySafeStorageSession(TEST_KEY_ID)).toThrow(
      'Private key keychain is not available until you sign in.',
    );
  });
});

describe('privateKeySafeStorageSession keychain lock flow', () => {
  const LOCKED_MESSAGE = /locked for this session/;

  beforeEach(() => {
    resetPrivateKeySafeStorageSession();
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: TEST_KEY_ID,
    });
  });

  it('allows load and has during unlock before arm-session', () => {
    expect(getPrivateKeySafeStorageSessionState().phase).toBe('unlock');
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).not.toThrow();
    expect(() => assertPrivateKeySafeStorageHas(TEST_KEY_ID)).not.toThrow();
  });

  it('blocks load, store, has, and file picker after arm-session', () => {
    armPrivateKeySafeStorageSession(TEST_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState().phase).toBe('locked');
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).toThrow(
      LOCKED_MESSAGE,
    );
    expect(() => assertPrivateKeySafeStorageStore(TEST_KEY_ID)).toThrow(
      LOCKED_MESSAGE,
    );
    expect(() => assertPrivateKeySafeStorageHas(TEST_KEY_ID)).toThrow(
      LOCKED_MESSAGE,
    );
    expect(() => assertPrivateKeySafeStoragePickFromDialog()).toThrow(
      LOCKED_MESSAGE,
    );
  });

  it('does not lock when arm-session keyId does not match the bound account', () => {
    armPrivateKeySafeStorageSession(OTHER_KEY_ID);

    expect(getPrivateKeySafeStorageSessionState().phase).toBe('unlock');
    expect(() => assertPrivateKeySafeStorageLoad(TEST_KEY_ID)).not.toThrow();
  });
});
