import { AUTH_NONCE_TTL_SECONDS, generateAuthNonce } from '@encrypt/core/crypto/authProof';
import { getRedisClient } from '../lib/redis.js';

export type AuthNonceStore = {
  mint(keyId: string): Promise<string>;
  consume(keyId: string, nonce: string): Promise<boolean>;
};

function nonceRedisKey(keyId: string): string {
  return `auth:nonce:${keyId}`;
}

const CONSUME_NONCE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export function createRedisAuthNonceStore(): AuthNonceStore {
  return {
    async mint(keyId: string): Promise<string> {
      const redis = await getRedisClient();
      const nonce = generateAuthNonce();
      await redis.set(nonceRedisKey(keyId), nonce, {
        EX: AUTH_NONCE_TTL_SECONDS,
      });
      return nonce;
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
  const entries = new Map<string, string>();

  return {
    async mint(keyId: string): Promise<string> {
      const nonce = generateAuthNonce();
      entries.set(keyId, nonce);
      return nonce;
    },

    async consume(keyId: string, nonce: string): Promise<boolean> {
      const current = entries.get(keyId);
      if (current !== nonce) {
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
  return getAuthNonceStore().mint(keyId);
}

export async function consumeAuthNonce(
  keyId: string,
  nonce: string,
): Promise<boolean> {
  return getAuthNonceStore().consume(keyId, nonce);
}
