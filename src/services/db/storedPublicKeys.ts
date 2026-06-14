import { importPublicKeyExtractable } from '@/crypto/ecdhKeys.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';
import { isRecord } from '@/utils/isRecord.ts';
import { USERS_STORE, USERS_USERNAME_INDEX, openCryptoDb } from './cryptoDb.ts';

export type StoredPublicKeyRecord = {
  keyId: string;
  publicJwk: JsonWebKey;
  username?: string;
  /** False until the user downloads their private key on first setup. */
  privateKeyDownloaded?: boolean;
};

export function requiresPrivateKeyOnboarding(
  record: StoredPublicKeyRecord | null,
): boolean {
  if (!record) return true;
  return record.privateKeyDownloaded === false;
}

type LoadedPublicKey = {
  publicKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
};

function ecPublicJwkFromStored(
  stored: Record<string, unknown>,
): JsonWebKey | null {
  const publicJwk = stored.publicJwk;
  if (!isRecord(publicJwk) || publicJwk.kty !== 'EC') {
    return null;
  }
  return publicJwk as JsonWebKey;
}

function parseStoredKeyRecord(value: unknown): StoredPublicKeyRecord | null {
  if (!isRecord(value) || typeof value.keyId !== 'string') {
    return null;
  }

  const publicJwk = ecPublicJwkFromStored(value);
  if (!publicJwk) {
    return null;
  }

  const username =
    typeof value.username === 'string' && value.username.length > 0
      ? value.username
      : undefined;

  const privateKeyDownloaded =
    typeof value.privateKeyDownloaded === 'boolean'
      ? value.privateKeyDownloaded
      : undefined;

  return { keyId: value.keyId, publicJwk, username, privateKeyDownloaded };
}

export async function saveStoredPublicKey(
  keyId: string,
  publicJwk: JsonWebKey,
  username?: string,
  privateKeyDownloaded?: boolean,
): Promise<void> {
  const db = await openCryptoDb();
  const slimJwk = slimEcPublicJwk(publicJwk);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const getRequest = store.get(keyId);

    getRequest.onsuccess = () => {
      const existing = parseStoredKeyRecord(getRequest.result);
      const record: StoredPublicKeyRecord = {
        keyId,
        publicJwk: slimJwk,
      };
      const resolvedUsername = username ?? existing?.username;
      if (resolvedUsername) {
        record.username = resolvedUsername;
      }
      if (privateKeyDownloaded !== undefined) {
        record.privateKeyDownloaded = privateKeyDownloaded;
      } else if (existing?.privateKeyDownloaded !== undefined) {
        record.privateKeyDownloaded = existing.privateKeyDownloaded;
      }
      store.put(record);
    };

    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveStoredPublicKeyForUsername(
  username: string,
  publicJwk: JsonWebKey,
  privateKeyDownloaded?: boolean,
): Promise<string> {
  const keyId = await ecPublicJwkThumbprintSha256(slimEcPublicJwk(publicJwk));
  await saveStoredPublicKey(keyId, publicJwk, username, privateKeyDownloaded);
  return keyId;
}

/** Save a 1:1 recipient (public key only) with onboarding already marked complete. */
export async function saveStoredRecipientForUsername(
  username: string,
  publicJwk: JsonWebKey,
): Promise<string> {
  return saveStoredPublicKeyForUsername(username, publicJwk, true);
}

export async function deleteStoredPublicKeyForUsername(
  username: string,
): Promise<void> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const index = store.index(USERS_USERNAME_INDEX);
    const request = index.get(username);

    request.onsuccess = () => {
      const record = parseStoredKeyRecord(request.result ?? null);
      if (record) {
        store.delete(record.keyId);
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markPrivateKeyDownloadedForUsername(
  username: string,
): Promise<void> {
  const stored = await loadStoredPublicKeyMaterial(username);
  if (!stored) {
    throw new Error('No stored public key for this user.');
  }
  await saveStoredPublicKey(stored.keyId, stored.publicJwk, username, true);
}

export async function loadStoredPublicKeyMaterialByKeyId(
  keyId: string,
): Promise<StoredPublicKeyRecord | null> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const request = store.get(keyId);

    request.onsuccess = () => {
      resolve(parseStoredKeyRecord(request.result ?? null));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadStoredPublicKeyMaterial(
  username: string,
): Promise<StoredPublicKeyRecord | null> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const index = store.index(USERS_USERNAME_INDEX);
    const request = index.get(username);

    request.onsuccess = () => {
      resolve(parseStoredKeyRecord(request.result ?? null));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredUsers(): Promise<
  Array<{ keyId: string; username: string }>
> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const users = (request.result ?? [])
        .map(parseStoredKeyRecord)
        .filter(
          (row): row is StoredPublicKeyRecord =>
            row !== null && Boolean(row.username),
        )
        .map((row) => ({ keyId: row.keyId, username: row.username! }))
        .sort((a, b) => a.username.localeCompare(b.username));
      resolve(users);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredUsernames(): Promise<string[]> {
  const users = await listStoredUsers();
  return users.map((user) => user.username);
}

export async function getUsernameForKeyId(
  keyId: string,
): Promise<string | null> {
  const record = await loadStoredPublicKeyMaterialByKeyId(keyId);
  return record?.username ?? null;
}

export async function loadPublicKeyFromStored(
  publicJwk: JsonWebKey,
): Promise<LoadedPublicKey> {
  const publicKey = await importPublicKeyExtractable(publicJwk);
  return {
    publicKey,
    publicKeyJwk: publicJwk,
  };
}

export async function loadRecipientKeysForUsername(
  username: string,
): Promise<ManifestRecipientKeys | null> {
  const stored = await loadStoredPublicKeyMaterial(username);
  if (!stored) {
    return null;
  }

  const { publicKey } = await loadPublicKeyFromStored(stored.publicJwk);

  return { keyId: stored.keyId, publicKey };
}

export async function loadRecipientKeysForKeyId(
  keyId: string,
): Promise<ManifestRecipientKeys | null> {
  const stored = await loadStoredPublicKeyMaterialByKeyId(keyId);
  if (!stored) {
    return null;
  }

  const { publicKey } = await loadPublicKeyFromStored(stored.publicJwk);

  return { keyId: stored.keyId, publicKey };
}
