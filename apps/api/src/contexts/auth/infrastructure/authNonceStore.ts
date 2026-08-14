import {
  AUTH_NONCE_MIN_REMAINING_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
  generateAuthNonce,
} from '@encrypt/core/crypto/authProof';
import { getRedisClient } from '@/lib/redis.js';
import type {
  AuthNonceEntry,
  AuthNonceStore,
  ConsumeAndRotateOutcome,
} from '@/contexts/auth/domain/ports/AuthNonceStore.js';
import {
  CONSUME_AND_ROTATE_NONCE_SCRIPT,
  CONSUME_NONCE_SCRIPT,
  consumeAndRotateOutcomeFromEvalResult,
  entryFromGetOrMintEvalResult,
  expiresAtMsFromPttl,
  GET_OR_MINT_NONCE_SCRIPT,
  nonceExpiresAtMsFromNow,
  nonceRedisKey,
} from './authNonceScripts.js';

function hasMinRemainingTtl(expiresAtMs: number): boolean {
  return expiresAtMs - Date.now() >= AUTH_NONCE_MIN_REMAINING_SECONDS * 1000;
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

    async consumeAndRotate(
      keyId: string,
      nonce: string,
    ): Promise<ConsumeAndRotateOutcome> {
      const redis = await getRedisClient();
      const nextNonce = generateAuthNonce();
      const result = await redis.eval(CONSUME_AND_ROTATE_NONCE_SCRIPT, {
        keys: [nonceRedisKey(keyId)],
        arguments: [nonce, nextNonce, String(AUTH_NONCE_TTL_SECONDS)],
      });
      return consumeAndRotateOutcomeFromEvalResult(result);
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
      return entryFromGetOrMintEvalResult(result);
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

    async consumeAndRotate(
      keyId: string,
      nonce: string,
    ): Promise<ConsumeAndRotateOutcome> {
      const current = entries.get(keyId);
      const validCurrent =
        current && Date.now() < current.expiresAtMs ? current : null;
      if (validCurrent && validCurrent.nonce !== nonce) {
        return { status: 'mismatch', entry: validCurrent };
      }
      const entry = {
        nonce: generateAuthNonce(),
        expiresAtMs: nonceExpiresAtMsFromNow(),
      };
      entries.set(keyId, entry);
      return validCurrent
        ? { status: 'rotated', entry }
        : { status: 'minted', entry };
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

export async function consumeAndRotateAuthNonce(
  keyId: string,
  nonce: string,
): Promise<ConsumeAndRotateOutcome> {
  return getAuthNonceStore().consumeAndRotate(keyId, nonce);
}
