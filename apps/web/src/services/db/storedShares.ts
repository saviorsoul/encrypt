import {
  openCryptoDb,
  SHARES_MESSAGE_ID_INDEX,
  SHARES_STORE,
  MESSAGE_KEY_MANIFEST_STORE,
} from './cryptoDb.ts';
import type { KeyManifestMap } from '@/types/manifest.ts';
import { putMessageKeyManifestShardsInTransaction } from './storedMessageKeyManifest.ts';
import { listMessageIdsForRecipientKeyId } from './storedMessageKeyManifest.ts';

export type StoredShare = {
  id: string;
  messageId: string;
  payload: string;
  createdAt: number;
};

function parseStoredShare(value: unknown): StoredShare | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as StoredShare).id !== 'string' ||
    typeof (value as StoredShare).messageId !== 'string' ||
    typeof (value as StoredShare).payload !== 'string' ||
    typeof (value as StoredShare).createdAt !== 'number'
  ) {
    return null;
  }

  return value as StoredShare;
}

export async function saveStoredShare(
  shareCoreJson: string,
  keyManifest: KeyManifestMap,
  messageId: string,
): Promise<StoredShare> {
  const share: StoredShare = {
    id: crypto.randomUUID(),
    payload: shareCoreJson,
    messageId,
    createdAt: Date.now(),
  };

  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [SHARES_STORE, MESSAGE_KEY_MANIFEST_STORE],
      'readwrite',
    );
    const sharesStore = tx.objectStore(SHARES_STORE);

    sharesStore.put(share);
    putMessageKeyManifestShardsInTransaction(tx, share.id, keyManifest);

    tx.oncomplete = () => resolve(share);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoredShareById(
  id: string,
): Promise<StoredShare | null> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARES_STORE, 'readonly');
    const store = tx.objectStore(SHARES_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(parseStoredShare(request.result) ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listShareDeliveriesForMessage(
  messageId: string,
): Promise<StoredShare[]> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARES_STORE, 'readonly');
    const store = tx.objectStore(SHARES_STORE);
    const index = store.index(SHARES_MESSAGE_ID_INDEX);
    const request = index.getAll(messageId);

    request.onsuccess = () => {
      const rows = (request.result ?? [])
        .map(parseStoredShare)
        .filter((row): row is StoredShare => row !== null)
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredSharesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredShare[]> {
  const messageIds = await listMessageIdsForRecipientKeyId(recipientKeyId);
  const shares = await Promise.all(
    messageIds.map((id) => getStoredShareById(id)),
  );
  return shares.filter((row): row is StoredShare => row !== null);
}
