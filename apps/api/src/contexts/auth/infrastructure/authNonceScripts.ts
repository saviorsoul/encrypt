import { AUTH_NONCE_TTL_SECONDS } from '@encrypt/core/crypto/authProof';
import type {
  AuthNonceEntry,
  ConsumeAndRotateOutcome,
} from '@/contexts/auth/domain/ports/AuthNonceStore.js';

export function nonceRedisKey(keyId: string): string {
  return `auth:nonce:${keyId}`;
}

export const CONSUME_NONCE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export const CONSUME_AND_ROTATE_NONCE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return {1, ARGV[2], tonumber(ARGV[3])}
end
if not current then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return {2, ARGV[2], tonumber(ARGV[3])}
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl <= 0 then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return {2, ARGV[2], tonumber(ARGV[3])}
end
return {3, current, pttl}
`;

export const GET_OR_MINT_NONCE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current then
  local pttl = redis.call('PTTL', KEYS[1])
  if pttl >= tonumber(ARGV[1]) then
    return {current, pttl}
  end
end
redis.call('SET', KEYS[1], ARGV[3], 'EX', tonumber(ARGV[2]))
local pttl = redis.call('PTTL', KEYS[1])
return {ARGV[3], pttl}
`;

export function nonceExpiresAtMsFromNow(): number {
  return Date.now() + AUTH_NONCE_TTL_SECONDS * 1000;
}

export function expiresAtMsFromPttl(pttlMs: number): number | null {
  if (pttlMs <= 0) {
    return null;
  }
  return Date.now() + pttlMs;
}

export function entryFromGetOrMintEvalResult(result: unknown): AuthNonceEntry {
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error('Unexpected Redis getOrMint script result.');
  }
  const [nonce, pttlMs] = result;
  if (typeof nonce !== 'string' || typeof pttlMs !== 'number') {
    throw new Error('Unexpected Redis getOrMint script result shape.');
  }
  const expiresAtMs = expiresAtMsFromPttl(pttlMs);
  if (expiresAtMs === null) {
    throw new Error('Redis getOrMint returned an entry without TTL.');
  }
  return { nonce, expiresAtMs };
}

export function consumeAndRotateOutcomeFromEvalResult(
  result: unknown,
): ConsumeAndRotateOutcome {
  if (!Array.isArray(result) || result.length !== 3) {
    throw new Error('Unexpected Redis consumeAndRotate script result.');
  }
  const [tag, nonce, ttlOrPttl] = result;
  if (typeof nonce !== 'string' || typeof ttlOrPttl !== 'number') {
    throw new Error('Unexpected Redis consumeAndRotate script result shape.');
  }

  if (tag === 1) {
    return {
      status: 'rotated',
      entry: { nonce, expiresAtMs: Date.now() + ttlOrPttl * 1000 },
    };
  }
  if (tag === 2) {
    return {
      status: 'minted',
      entry: { nonce, expiresAtMs: Date.now() + ttlOrPttl * 1000 },
    };
  }
  if (tag === 3) {
    const expiresAtMs = expiresAtMsFromPttl(ttlOrPttl);
    if (expiresAtMs === null) {
      throw new Error(
        'Redis consumeAndRotate mismatch returned entry without TTL.',
      );
    }
    return { status: 'mismatch', entry: { nonce, expiresAtMs } };
  }
  throw new Error('Unexpected Redis consumeAndRotate script result shape.');
}
