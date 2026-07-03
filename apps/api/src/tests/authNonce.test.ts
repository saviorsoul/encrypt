import { afterEach, describe, expect, it } from 'vitest';
import { AUTH_NONCE_BYTES } from '@encrypt/core/crypto/authProof';
import { base64ToBytes } from '@encrypt/core/utils/bytes';
import {
  consumeAuthNonce,
  createMemoryAuthNonceStore,
  mintAuthNonce,
  setAuthNonceStoreForTests,
} from '../services/authNonce.js';

describe('authNonce', () => {
  afterEach(() => {
    setAuthNonceStoreForTests(null);
  });

  it('mints and consumes a nonce once', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const nonce = await mintAuthNonce(keyId);

    expect(await consumeAuthNonce(keyId, nonce)).toBe(true);
    expect(await consumeAuthNonce(keyId, nonce)).toBe(false);
  });

  it('isolates nonces by keyId', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const nonce = await mintAuthNonce('key-a');

    expect(await consumeAuthNonce('key-b', nonce)).toBe(false);
    expect(await consumeAuthNonce('key-a', nonce)).toBe(true);
  });

  it('replaces an unconsumed nonce on mint', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const first = await mintAuthNonce(keyId);
    const second = await mintAuthNonce(keyId);

    expect(await consumeAuthNonce(keyId, first)).toBe(false);
    expect(await consumeAuthNonce(keyId, second)).toBe(true);
  });

  it('mints nonces as 12-byte standard base64', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const nonce = await mintAuthNonce('test-key-id');
    expect(base64ToBytes(nonce).length).toBe(AUTH_NONCE_BYTES);
  });
});
