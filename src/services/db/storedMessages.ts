import {
  openCryptoDb,
  MESSAGES_STORE,
  MESSAGE_KEY_MANIFEST_STORE,
} from './cryptoDb.ts';
import { getSenderKeyIdFromCorePayload } from '@/crypto/manifestDecrypt.ts';
import { splitManifestForStorage } from '@/crypto/manifestStorage.ts';
import { putMessageKeyManifestShardsInTransaction } from './storedMessageKeyManifest.ts';
import {
  getMessageKeyManifestEntry,
  listMessageIdsForRecipientKeyId,
} from './storedMessageKeyManifest.ts';
import { getStoredShareById, type StoredShare } from './storedShares.ts';

export type StoredMessage = {
  id: string;
  payload: string;
  createdAt: number;
};

export type StoredFeedDelivery = StoredMessage | StoredShare;

function parseStoredMessage(value: unknown): StoredMessage | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as StoredMessage).id !== 'string' ||
    typeof (value as StoredMessage).payload !== 'string' ||
    typeof (value as StoredMessage).createdAt !== 'number'
  ) {
    return null;
  }

  return value as StoredMessage;
}

/** Store a message core without key-manifest shards (e.g. imported share parent). */
export async function saveStoredMessageCoreWithId(
  id: string,
  corePayloadJson: string,
): Promise<StoredMessage> {
  const message: StoredMessage = {
    id,
    payload: corePayloadJson,
    createdAt: Date.now(),
  };

  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);
    store.put(message);
    tx.oncomplete = () => resolve(message);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveStoredMessage(
  fullPayload: string,
): Promise<StoredMessage> {
  return saveStoredMessageWithId(crypto.randomUUID(), fullPayload);
}

export async function saveStoredMessageWithId(
  id: string,
  fullPayload: string,
): Promise<StoredMessage> {
  const { corePayloadJson, keyManifest } = splitManifestForStorage(fullPayload);
  const message: StoredMessage = {
    id,
    payload: corePayloadJson,
    createdAt: Date.now(),
  };

  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [MESSAGES_STORE, MESSAGE_KEY_MANIFEST_STORE],
      'readwrite',
    );
    const messagesStore = tx.objectStore(MESSAGES_STORE);

    messagesStore.put(message);
    putMessageKeyManifestShardsInTransaction(tx, message.id, keyManifest);

    tx.oncomplete = () => resolve(message);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoredMessageById(
  id: string,
): Promise<StoredMessage | null> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly');
    const store = tx.objectStore(MESSAGES_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(parseStoredMessage(request.result) ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getStoredFeedDeliveryById(
  id: string,
): Promise<StoredFeedDelivery | null> {
  const message = await getStoredMessageById(id);
  if (message) {
    return message;
  }
  return getStoredShareById(id);
}

export async function listStoredMessages(): Promise<StoredMessage[]> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly');
    const store = tx.objectStore(MESSAGES_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const rows = (request.result ?? [])
        .map(parseStoredMessage)
        .filter((row): row is StoredMessage => row !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredMessagesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredFeedDelivery[]> {
  const messageIds = await listMessageIdsForRecipientKeyId(recipientKeyId);
  const deliveries: StoredFeedDelivery[] = [];
  const existingIds = new Set<string>();

  for (const id of messageIds) {
    const message = await getStoredMessageById(id);
    if (message) {
      deliveries.push(message);
      existingIds.add(id);
      continue;
    }

    const share = await getStoredShareById(id);
    if (share) {
      deliveries.push(share);
      existingIds.add(id);
    }
  }

  const parentIds = new Set<string>();
  for (const delivery of deliveries) {
    if ('messageId' in delivery) {
      parentIds.add(delivery.messageId);
    }
  }

  for (const parentId of parentIds) {
    if (existingIds.has(parentId)) {
      continue;
    }
    const parent = await getStoredMessageById(parentId);
    if (parent) {
      deliveries.push(parent);
      existingIds.add(parentId);
    }
  }

  return deliveries.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSenderKeyIdFromPayload(
  payload: string,
): Promise<string | null> {
  return getSenderKeyIdFromCorePayload(payload);
}

export { getMessageKeyManifestEntry };
export type { StoredShare } from './storedShares.ts';
export {
  saveStoredShare,
  listShareDeliveriesForMessage,
} from './storedShares.ts';
