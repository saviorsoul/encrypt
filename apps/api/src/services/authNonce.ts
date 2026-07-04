import {
  AUTH_NONCE_MIN_REMAINING_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
  generateAuthNonce,
} from '@encrypt/core/crypto/authProof';
import { getRedisClient } from '../lib/redis.js';

export type AuthNonceEntry = {
  nonce: string;
  expiresAtMs: number;
};

export type AuthNonceStore = {
  mint(keyId: string): Promise<AuthNonceEntry>;
  get(keyId: string): Promise<AuthNonceEntry | null>;
  consume(keyId: string, nonce: string): Promise<boolean>;
};

function nonceRedisKey(keyId: string): string {
  return `auth:nonce:${keyId}`;
}

function nonceExpiresAtMsFromNow(): number {
  return Date.now() + AUTH_NONCE_TTL_SECONDS * 1000;
}

function hasMinRemainingTtl(expiresAtMs: number): boolean {
  return expiresAtMs - Date.now() >= AUTH_NONCE_MIN_REMAINING_SECONDS * 1000;
}

const CONSUME_NONCE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export function createRedisAuthNonceStore(): AuthNonceStore {
  return {
    async mint(keyId: string): Promise<AuthNonceEntry> {
      const redis = await getRedisClient();
      const nonce = generateAuthNonce();
      await redis.set(nonceRedisKey(keyId), nonce, {
        EX: AUTH_NONCE_TTL_SECONDS,
      });
      return { nonce, expiresAtMs: nonceExpiresAtMsFromNow() };
    },

    async get(keyId: string): Promise<AuthNonceEntry | null> {
      const redis = await getRedisClient();
      const key = nonceRedisKey(keyId);
      const nonce = await redis.get(key);
      if (!nonce) {
        return null;
      }
      const ttlSeconds = await redis.ttl(key);
      if (ttlSeconds <= 0) {
        return null;
      }
      return {
        nonce,
        expiresAtMs: Date.now() + ttlSeconds * 1000,
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

export async function mintAuthNonce(keyId: string): Promise<string> {
  const entry = await getAuthNonceStore().mint(keyId);
  return entry.nonce;
}

export async function getOrMintAuthNonce(
  keyId: string,
): Promise<AuthNonceEntry> {
  const store = getAuthNonceStore();
  const existing = await store.get(keyId);
  if (existing && hasMinRemainingTtl(existing.expiresAtMs)) {
    return existing;
  }
  return store.mint(keyId);
}

export async function consumeAuthNonce(
  keyId: string,
  nonce: string,
): Promise<boolean> {
  return getAuthNonceStore().consume(keyId, nonce);
}
