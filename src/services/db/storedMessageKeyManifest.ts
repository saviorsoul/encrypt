import {
  openCryptoDb,
  MESSAGE_KEY_MANIFEST_STORE,
  MESSAGE_KEY_MANIFEST_KEY_ID_INDEX,
  MESSAGE_KEY_MANIFEST_MESSAGE_ID_INDEX,
} from './cryptoDb.ts';
import type {
  KeyManifestMap,
  KeyManifestRecipientPayload,
} from '@/types/manifest.ts';

export type StoredMessageKeyManifestShard = {
  messageId: string;
  keyId: string;
  entry: KeyManifestRecipientPayload;
};

function parseShard(value: unknown): StoredMessageKeyManifestShard | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as StoredMessageKeyManifestShard).messageId !== 'string' ||
    typeof (value as StoredMessageKeyManifestShard).keyId !== 'string' ||
    typeof (value as StoredMessageKeyManifestShard).entry !== 'object' ||
    (value as StoredMessageKeyManifestShard).entry === null
  ) {
    return null;
  }

  return value as StoredMessageKeyManifestShard;
}

export function putMessageKeyManifestShardsInTransaction(
  tx: IDBTransaction,
  messageId: string,
  keyManifest: KeyManifestMap,
): void {
  const store = tx.objectStore(MESSAGE_KEY_MANIFEST_STORE);
  for (const [keyId, entry] of Object.entries(keyManifest)) {
    store.put({ messageId, keyId, entry });
  }
}

export async function getMessageKeyManifestEntry(
  messageId: string,
  keyId: string,
): Promise<KeyManifestRecipientPayload | null> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGE_KEY_MANIFEST_STORE, 'readonly');
    const store = tx.objectStore(MESSAGE_KEY_MANIFEST_STORE);
    const request = store.get([messageId, keyId]);

    request.onsuccess = () => {
      const shard = parseShard(request.result);
      resolve(shard?.entry ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function hasMessageKeyManifestShard(
  messageId: string,
  keyId: string,
): Promise<boolean> {
  const entry = await getMessageKeyManifestEntry(messageId, keyId);
  return entry !== null;
}

export async function listMessageIdsForRecipientKeyId(
  keyId: string,
): Promise<string[]> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGE_KEY_MANIFEST_STORE, 'readonly');
    const store = tx.objectStore(MESSAGE_KEY_MANIFEST_STORE);
    const index = store.index(MESSAGE_KEY_MANIFEST_KEY_ID_INDEX);
    const request = index.getAll(keyId);

    request.onsuccess = () => {
      const messageIds = new Set<string>();
      for (const row of request.result ?? []) {
        const shard = parseShard(row);
        if (shard) {
          messageIds.add(shard.messageId);
        }
      }
      resolve([...messageIds]);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listKeyIdsForMessage(
  messageId: string,
): Promise<string[]> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGE_KEY_MANIFEST_STORE, 'readonly');
    const store = tx.objectStore(MESSAGE_KEY_MANIFEST_STORE);
    const index = store.index(MESSAGE_KEY_MANIFEST_MESSAGE_ID_INDEX);
    const request = index.getAll(messageId);

    request.onsuccess = () => {
      const keyIds = (request.result ?? [])
        .map(parseShard)
        .filter((row): row is StoredMessageKeyManifestShard => row !== null)
        .map((row) => row.keyId);
      resolve(keyIds);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getKeyManifestForMessage(
  messageId: string,
): Promise<KeyManifestMap> {
  const keyIds = await listKeyIdsForMessage(messageId);
  if (keyIds.length === 0) {
    throw new Error('Message has no key manifest entries.');
  }

  const keyManifest: KeyManifestMap = {};
  for (const keyId of keyIds) {
    const entry = await getMessageKeyManifestEntry(messageId, keyId);
    if (!entry) {
      throw new Error(`Missing key manifest entry for recipient ${keyId}.`);
    }
    keyManifest[keyId] = entry;
  }

  return keyManifest;
}
