import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import {
  openFeedLabDb,
  USERS_STORE,
  USERS_USERNAME_INDEX,
} from './feedLabDb.ts';

export type FeedLabStoredUser = {
  keyId: string;
  username: string;
  publicJwk: JsonWebKey;
};

function parseStoredUser(value: unknown): FeedLabStoredUser | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { keyId?: unknown }).keyId !== 'string' ||
    typeof (value as { username?: unknown }).username !== 'string'
  ) {
    return null;
  }

  const record = value as {
    keyId: string;
    username: string;
    publicJwk?: unknown;
  };

  if (
    typeof record.publicJwk !== 'object' ||
    record.publicJwk === null ||
    typeof (record.publicJwk as { x?: unknown }).x !== 'string' ||
    typeof (record.publicJwk as { y?: unknown }).y !== 'string'
  ) {
    return null;
  }

  try {
    return {
      keyId: record.keyId,
      username: record.username,
      publicJwk: slimEcPublicJwk(record.publicJwk as JsonWebKey),
    };
  } catch {
    return null;
  }
}

export async function saveFeedLabUser(
  username: string,
  publicJwk: JsonWebKey,
): Promise<string> {
  const slimJwk = slimEcPublicJwk(publicJwk);
  const keyId = await ecPublicJwkThumbprintSha256(slimJwk);
  const db = await openFeedLabDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    store.put({ keyId, username, publicJwk: slimJwk });
    tx.oncomplete = () => resolve(keyId);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listFeedLabStoredUsers(): Promise<FeedLabStoredUser[]> {
  const db = await openFeedLabDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const users = (request.result ?? [])
        .map(parseStoredUser)
        .filter((row): row is FeedLabStoredUser => row !== null)
        .sort((a, b) => a.username.localeCompare(b.username));
      resolve(users);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadFeedLabUserByKeyId(
  keyId: string,
): Promise<FeedLabStoredUser | null> {
  const db = await openFeedLabDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const request = store.get(keyId);

    request.onsuccess = () => {
      resolve(parseStoredUser(request.result ?? null));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadFeedLabUserByUsername(
  username: string,
): Promise<FeedLabStoredUser | null> {
  const db = await openFeedLabDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const index = store.index(USERS_USERNAME_INDEX);
    const request = index.get(username);

    request.onsuccess = () => {
      resolve(parseStoredUser(request.result ?? null));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadRecipientKeysForUsername(
  username: string,
): Promise<ManifestRecipientKeys | null> {
  const stored = await loadFeedLabUserByUsername(username);

  if (!stored) {
    return null;
  }

  const publicKey = await importPublicKeyExtractable(stored.publicJwk);
  return { keyId: stored.keyId, publicKey };
}
