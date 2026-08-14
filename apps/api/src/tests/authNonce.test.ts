import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_NONCE_BYTES,
  AUTH_NONCE_MIN_REMAINING_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
} from '@encrypt/core/crypto/authProof';
import { base64ToBytes } from '@encrypt/core/utils/bytes';
import {
  consumeAndRotateAuthNonce,
  consumeAuthNonce,
  createMemoryAuthNonceStore,
  getOrMintAuthNonce,
  mintAuthNonce,
  setAuthNonceStoreForTests,
  type AuthNonceEntry,
  type ConsumeAndRotateOutcome,
} from '@/contexts/auth/index.js';

function expectConsumeAndRotateOutcome(
  outcome: ConsumeAndRotateOutcome,
  status: ConsumeAndRotateOutcome['status'],
): AuthNonceEntry {
  expect(outcome.status).toBe(status);
  if (outcome.status !== status) {
    throw new Error(`Expected ${status} outcome, got ${outcome.status}`);
  }
  return outcome.entry;
}

describe('authNonce', () => {
  afterEach(() => {
    setAuthNonceStoreForTests(null);
  });

  it('mints and consumes a nonce once', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const { nonce } = await mintAuthNonce(keyId);

    expect(await consumeAuthNonce(keyId, nonce)).toBe(true);
    expect(await consumeAuthNonce(keyId, nonce)).toBe(false);
  });

  it('isolates nonces by keyId', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const { nonce } = await mintAuthNonce('key-a');

    expect(await consumeAuthNonce('key-b', nonce)).toBe(false);
    expect(await consumeAuthNonce('key-a', nonce)).toBe(true);
  });

  it('replaces an unconsumed nonce on mint', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const first = await mintAuthNonce(keyId);
    const second = await mintAuthNonce(keyId);

    expect(await consumeAuthNonce(keyId, first.nonce)).toBe(false);
    expect(await consumeAuthNonce(keyId, second.nonce)).toBe(true);
  });

  it('returns an existing nonce from getOrMint without replacing it', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const minted = await mintAuthNonce(keyId);
    const reused = await getOrMintAuthNonce(keyId);

    expect(reused.nonce).toBe(minted.nonce);
    expect(await consumeAuthNonce(keyId, minted.nonce)).toBe(true);
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

  it('returns the same expiresAt from getOrMint on repeated reads', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const first = await getOrMintAuthNonce(keyId);
    const second = await getOrMintAuthNonce(keyId);

    expect(second.nonce).toBe(first.nonce);
    expect(second.expiresAtMs).toBe(first.expiresAtMs);
  });

  it('returns the same nonce from concurrent getOrMint calls', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const keyId = 'test-key-id';
    const results = await Promise.all([
      getOrMintAuthNonce(keyId),
      getOrMintAuthNonce(keyId),
      getOrMintAuthNonce(keyId),
    ]);

    expect(results[0]!.nonce).toBe(results[1]!.nonce);
    expect(results[1]!.nonce).toBe(results[2]!.nonce);
    expect(await consumeAuthNonce(keyId, results[0]!.nonce)).toBe(true);
  });

  it('mints nonces as 12-byte standard base64', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const { nonce } = await mintAuthNonce('test-key-id');
    expect(base64ToBytes(nonce).length).toBe(AUTH_NONCE_BYTES);
  });

  describe('consumeAndRotate', () => {
    it('consumes the pending nonce and returns a fresh next nonce', async () => {
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const keyId = 'test-key-id';
      const minted = await mintAuthNonce(keyId);

      const outcome = await consumeAndRotateAuthNonce(keyId, minted.nonce);
      const entry = expectConsumeAndRotateOutcome(outcome, 'rotated');
      expect(entry.nonce).not.toBe(minted.nonce);
      expect(entry.expiresAtMs).toBeGreaterThan(Date.now());
      expect(await consumeAuthNonce(keyId, minted.nonce)).toBe(false);
      expect(await consumeAuthNonce(keyId, entry.nonce)).toBe(true);
    });

    it('returns mismatch with the pending redis nonce when presented nonce differs', async () => {
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const keyId = 'test-key-id';
      const minted = await mintAuthNonce(keyId);

      const outcome = await consumeAndRotateAuthNonce(keyId, 'invalid-nonce');
      const pending = expectConsumeAndRotateOutcome(outcome, 'mismatch');
      expect(pending.nonce).toBe(minted.nonce);
      expect(await consumeAuthNonce(keyId, pending.nonce)).toBe(true);
    });

    it('mints a fresh nonce when none is pending', async () => {
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const keyId = 'test-key-id';

      const outcome = await consumeAndRotateAuthNonce(keyId, 'any-nonce');
      const entry = expectConsumeAndRotateOutcome(outcome, 'minted');
      expect(entry.nonce).toBeTruthy();
      expect(entry.expiresAtMs).toBeGreaterThan(Date.now());
      expect(await consumeAuthNonce(keyId, entry.nonce)).toBe(true);
    });

    it('mints when the pending nonce expired', async () => {
      vi.useFakeTimers();
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const keyId = 'test-key-id';
      const minted = await mintAuthNonce(keyId);

      vi.advanceTimersByTime(AUTH_NONCE_TTL_SECONDS * 1000 + 1);

      const outcome = await consumeAndRotateAuthNonce(keyId, minted.nonce);
      const entry = expectConsumeAndRotateOutcome(outcome, 'minted');
      expect(entry.nonce).not.toBe(minted.nonce);
      expect(await consumeAuthNonce(keyId, entry.nonce)).toBe(true);
      vi.useRealTimers();
    });

    it('returns mismatch on replay after a successful consumeAndRotate', async () => {
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const keyId = 'test-key-id';
      const minted = await mintAuthNonce(keyId);

      const first = await consumeAndRotateAuthNonce(keyId, minted.nonce);
      const firstEntry = expectConsumeAndRotateOutcome(first, 'rotated');

      const replay = await consumeAndRotateAuthNonce(keyId, minted.nonce);
      const mismatchEntry = expectConsumeAndRotateOutcome(replay, 'mismatch');
      expect(mismatchEntry.nonce).toBe(firstEntry.nonce);
      expect(mismatchEntry.nonce).not.toBe(minted.nonce);
    });

    it('isolates consumeAndRotate by keyId', async () => {
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const minted = await mintAuthNonce('key-a');

      const keyBOutcome = await consumeAndRotateAuthNonce(
        'key-b',
        minted.nonce,
      );
      expect(keyBOutcome.status).toBe('minted');
      const next = await consumeAndRotateAuthNonce('key-a', minted.nonce);
      expect(next.status).toBe('rotated');
    });

    it('chains consumeAndRotate across sequential requests', async () => {
      setAuthNonceStoreForTests(createMemoryAuthNonceStore());
      const keyId = 'test-key-id';
      const first = await mintAuthNonce(keyId);
      const second = await consumeAndRotateAuthNonce(keyId, first.nonce);
      const secondEntry = expectConsumeAndRotateOutcome(second, 'rotated');

      const third = await consumeAndRotateAuthNonce(keyId, secondEntry.nonce);
      const thirdEntry = expectConsumeAndRotateOutcome(third, 'rotated');
      expect(thirdEntry.nonce).not.toBe(secondEntry.nonce);
    });
  });
});
