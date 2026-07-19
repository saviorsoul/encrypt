import {
  AUTH_NONCE_MIN_REMAINING_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
  generateAuthNonce,
} from '@encrypt/core/crypto/authProof';
import { getRedisClient } from '@/lib/redis.js';
import type {
  AuthNonceEntry,
  AuthNonceStore,
} from '@/contexts/auth/domain/ports/AuthNonceStore.js';

function nonceRedisKey(keyId: string): string {
  return `auth:nonce:${keyId}`;
}

function nonceExpiresAtMsFromNow(): number {
  return Date.now() + AUTH_NONCE_TTL_SECONDS * 1000;
}

function hasMinRemainingTtl(expiresAtMs: number): boolean {
  return expiresAtMs - Date.now() >= AUTH_NONCE_MIN_REMAINING_SECONDS * 1000;
}

function expiresAtMsFromPttl(pttlMs: number): number | null {
  if (pttlMs <= 0) {
    return null;
  }
  return Date.now() + pttlMs;
}

const CONSUME_NONCE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

const GET_OR_MINT_NONCE_SCRIPT = `
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

function entryFromEvalResult(result: unknown): AuthNonceEntry {
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

export function createRedisAuthNonceStore(): AuthNonceStore {
  return {
    async mint(keyId: string): Promise<AuthNonceEntry> {
      const redis = await getRedisClient();
      const nonce = generateAuthNonce();
      const key = nonceRedisKey(keyId);
      await redis.set(key, nonce, {
        EX: AUTH_NONCE_TTL_SECONDS,
      });
      const pttlMs = await redis.pTTL(key);
      const expiresAtMs =
        expiresAtMsFromPttl(pttlMs) ?? nonceExpiresAtMsFromNow();
      return { nonce, expiresAtMs };
    },

    async get(keyId: string): Promise<AuthNonceEntry | null> {
      const redis = await getRedisClient();
      const key = nonceRedisKey(keyId);
      const nonce = await redis.get(key);
      if (!nonce) {
        return null;
      }
      const pttlMs = await redis.pTTL(key);
      const expiresAtMs = expiresAtMsFromPttl(pttlMs);
      if (expiresAtMs === null) {
        return null;
      }
      return {
        nonce,
        expiresAtMs,
      };
    },

    async consume(keyId: string, nonce: string): Promise<boolean> {
      const redis = await getRedisClient();
      const deleted = await redis.eval(CONSUME_NONCE_SCRIPT, {
        keys: [nonceRedisKey(keyId)],
        arguments: [nonce],
      });
      return deleted === 1;
    },

    async getOrMint(keyId: string): Promise<AuthNonceEntry> {
      const redis = await getRedisClient();
      const result = await redis.eval(GET_OR_MINT_NONCE_SCRIPT, {
        keys: [nonceRedisKey(keyId)],
        arguments: [
          String(AUTH_NONCE_MIN_REMAINING_SECONDS * 1000),
          String(AUTH_NONCE_TTL_SECONDS),
          generateAuthNonce(),
        ],
      });
      return entryFromEvalResult(result);
    },
  };
}

export function createMemoryAuthNonceStore(): AuthNonceStore {
  const entries = new Map<string, AuthNonceEntry>();

  return {
    async mint(keyId: string): Promise<AuthNonceEntry> {
      const entry = {
        nonce: generateAuthNonce(),
        expiresAtMs: nonceExpiresAtMsFromNow(),
      };
      entries.set(keyId, entry);
      return entry;
    },

    async get(keyId: string): Promise<AuthNonceEntry | null> {
      const entry = entries.get(keyId);
      if (!entry) {
        return null;
      }
      if (Date.now() >= entry.expiresAtMs) {
        entries.delete(keyId);
        return null;
      }
      return entry;
    },

    async consume(keyId: string, nonce: string): Promise<boolean> {
      const current = entries.get(keyId);
      if (!current || current.nonce !== nonce) {
        return false;
      }
      entries.delete(keyId);
      return true;
    },

    async getOrMint(keyId: string): Promise<AuthNonceEntry> {
      const existing = entries.get(keyId);
      if (
        existing &&
        Date.now() < existing.expiresAtMs &&
        hasMinRemainingTtl(existing.expiresAtMs)
      ) {
        return existing;
      }
      const entry = {
        nonce: generateAuthNonce(),
        expiresAtMs: nonceExpiresAtMsFromNow(),
      };
      entries.set(keyId, entry);
      return entry;
    },
  };
}

let defaultStore: AuthNonceStore | null = null;

export function getAuthNonceStore(): AuthNonceStore {
  if (!defaultStore) {
    defaultStore = createRedisAuthNonceStore();
  }
  return defaultStore;
}

/** @internal Tests inject an in-memory store. */
export function setAuthNonceStoreForTests(store: AuthNonceStore | null): void {
  defaultStore = store;
}

export async function mintAuthNonce(keyId: string): Promise<AuthNonceEntry> {
  return getAuthNonceStore().mint(keyId);
}

export async function getOrMintAuthNonce(
  keyId: string,
): Promise<AuthNonceEntry> {
  return getAuthNonceStore().getOrMint(keyId);
}

export async function consumeAuthNonce(
  keyId: string,
  nonce: string,
): Promise<boolean> {
  return getAuthNonceStore().consume(keyId, nonce);
}
