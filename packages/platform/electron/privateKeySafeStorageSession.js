/** @typedef {'boot' | 'unlock' | 'locked'} PrivateKeySafeStoragePhase */

import {
  ELECTRON_KEYCHAIN_LOCKED,
  ELECTRON_KEYCHAIN_OPERATION_NOT_ALLOWED,
  ELECTRON_KEYCHAIN_SESSION_NOT_BOUND,
  ELECTRON_KEYCHAIN_UNAVAILABLE,
} from './privateKeySafeStorageSessionErrors.js';

/** RFC 7638 SHA-256 thumbprint encoded as unpadded base64url (43 chars). */
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class PrivateKeySafeStorageSessionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PrivateKeySafeStorageSessionError';
  }
}

/** @type {PrivateKeySafeStoragePhase} */
let phase = 'boot';

/** @type {string | null} */
let boundKeyId = null;

/** @type {boolean} */
let isLoggedIn = false;

export function getPrivateKeySafeStorageSessionState() {
  return { phase, boundKeyId, isLoggedIn };
}

export function resetPrivateKeySafeStorageSession() {
  phase = 'boot';
  boundKeyId = null;
  isLoggedIn = false;
}

/**
 * @param {{ isLoggedIn?: boolean; keyId?: string | null }} state
 */
export function setPrivateKeySafeStorageAuthState(state) {
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

/**
 * @param {string} keyId
 */
export function beginPrivateKeySafeStorageSession(keyId) {
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

/**
 * @param {string} keyId
 */
function assertBoundKeyId(keyId) {
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

/**
 * @param {string} keyId
 */
export function assertPrivateKeySafeStorageHas(keyId) {
  assertUnlockPhase();
  if (boundKeyId) {
    assertBoundKeyId(keyId);
  }
}

/**
 * @param {string} keyId
 */
export function assertPrivateKeySafeStorageStore(keyId) {
  assertUnlockPhase();
  assertBoundKeyId(keyId);
}

/**
 * @param {string} keyId
 */
export function assertPrivateKeySafeStorageLoad(keyId) {
  assertUnlockPhase();
  assertBoundKeyId(keyId);
}

export function assertPrivateKeySafeStoragePickFromDialog() {
  assertUnlockPhase();
}

/**
 * Lock keychain IPC after the renderer has imported and cached the private key.
 * @param {string} keyId
 */
export function armPrivateKeySafeStorageSession(keyId) {
  if (phase === 'unlock' && boundKeyId && keyId === boundKeyId) {
    phase = 'locked';
  }
}
