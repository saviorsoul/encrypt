import {
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
} from './privateKeySafeStorageSessionErrors.ts';

export type PrivateKeySafeStoragePhase = 'boot' | 'unlock' | 'locked';

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class PrivateKeySafeStorageSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivateKeySafeStorageSessionError';
  }
}

let phase: PrivateKeySafeStoragePhase = 'boot';
let boundKeyId: string | null = null;
let isLoggedIn = false;

export function getPrivateKeySafeStorageSessionState() {
  return { phase, boundKeyId, isLoggedIn };
}

export function resetPrivateKeySafeStorageSession() {
  phase = 'boot';
  boundKeyId = null;
  isLoggedIn = false;
}

export function setPrivateKeySafeStorageAuthState(state: {
  isLoggedIn?: boolean;
  keyId?: string | null;
}) {
  isLoggedIn = Boolean(state?.isLoggedIn);
  if (!isLoggedIn) {
    resetPrivateKeySafeStorageSession();
    return;
  }

  if (phase === 'boot') {
    phase = 'unlock';
  }

  if (typeof state?.keyId === 'string' && KEY_ID_PATTERN.test(state.keyId)) {
    boundKeyId = state.keyId;
  }
}

export function beginPrivateKeySafeStorageSession(keyId: string) {
  if (!isLoggedIn) {
    throw new PrivateKeySafeStorageSessionError(ELECTRON_KEYCHAIN_UNAVAILABLE);
  }

  if (typeof keyId !== 'string' || !KEY_ID_PATTERN.test(keyId)) {
    throw new PrivateKeySafeStorageSessionError('Invalid private key id.');
  }

  if (phase === 'boot') {
    phase = 'unlock';
  }

  boundKeyId = keyId;
}

function assertUnlockPhase() {
  if (phase === 'boot') {
    throw new PrivateKeySafeStorageSessionError(ELECTRON_KEYCHAIN_UNAVAILABLE);
  }

  if (phase === 'locked') {
    throw new PrivateKeySafeStorageSessionError(ELECTRON_KEYCHAIN_LOCKED);
  }
}

function assertBoundKeyId(keyId: string) {
  if (!boundKeyId) {
    throw new PrivateKeySafeStorageSessionError(
      ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
    );
  }

  if (keyId !== boundKeyId) {
    throw new PrivateKeySafeStorageSessionError(
      ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
    );
  }
}

export function assertPrivateKeySafeStorageHas(keyId: string) {
  assertUnlockPhase();
  if (boundKeyId) {
    assertBoundKeyId(keyId);
  }
}

export function assertPrivateKeySafeStorageStore(keyId: string) {
  assertUnlockPhase();
  assertBoundKeyId(keyId);
}

export function assertPrivateKeySafeStorageLoad(keyId: string) {
  assertUnlockPhase();
  assertBoundKeyId(keyId);
}

export function assertPrivateKeySafeStoragePickFromDialog() {
  assertUnlockPhase();
}

export function armPrivateKeySafeStorageSession(keyId: string) {
  if (phase === 'unlock' && boundKeyId && keyId === boundKeyId) {
    phase = 'locked';
  }
}
