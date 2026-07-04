import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_NONCE_BYTES,
  AUTH_NONCE_MIN_REMAINING_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
} from '@encrypt/core/crypto/authProof';
import { base64ToBytes } from '@encrypt/core/utils/bytes';
import {
  consumeAuthNonce,
  createMemoryAuthNonceStore,
  getOrMintAuthNonce,
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

  it('returns an existing nonce from getOrMint without replacing it', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const minted = await mintAuthNonce(keyId);
    const reused = await getOrMintAuthNonce(keyId);

    expect(reused.nonce).toBe(minted);
    expect(await consumeAuthNonce(keyId, minted)).toBe(true);
  });

  it('mints a nonce from getOrMint when none exists', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const entry = await getOrMintAuthNonce(keyId);

    expect(entry.nonce).toBeTruthy();
    expect(await consumeAuthNonce(keyId, entry.nonce)).toBe(true);
  });

  it('remints from getOrMint when the pending nonce is near expiry', async () => {
    vi.useFakeTimers();
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const first = await getOrMintAuthNonce(keyId);

    vi.advanceTimersByTime(
      AUTH_NONCE_TTL_SECONDS * 1000 -
        (AUTH_NONCE_MIN_REMAINING_SECONDS - 1) * 1000,
    );

    const second = await getOrMintAuthNonce(keyId);
    expect(second.nonce).not.toBe(first.nonce);
    expect(await consumeAuthNonce(keyId, first.nonce)).toBe(false);
    expect(await consumeAuthNonce(keyId, second.nonce)).toBe(true);
    vi.useRealTimers();
  });

  it('mints nonces as 12-byte standard base64', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const nonce = await mintAuthNonce('test-key-id');
    expect(base64ToBytes(nonce).length).toBe(AUTH_NONCE_BYTES);
  });
});
