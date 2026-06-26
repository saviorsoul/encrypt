import {
  openCryptoDb,
  MESSAGES_PARENT_MESSAGE_ID_INDEX,
  MESSAGES_STORE,
  MESSAGE_KEY_MANIFEST_STORE,
} from './cryptoDb.ts';
import type { KeyManifestMap } from '@/types/manifest.ts';
import { getSenderKeyIdFromCorePayload } from '@/crypto/manifestDecrypt.ts';
import { splitManifestForStorage } from '@/crypto/manifestStorage.ts';
import { putMessageKeyManifestShardsInTransaction } from './storedMessageKeyManifest.ts';
import {
  getMessageKeyManifestEntry,
  listMessageIdsForRecipientKeyId,
} from './storedMessageKeyManifest.ts';
import { isShareDelivery } from '@/crypto/manifestShare.ts';

export type StoredMessage = {
  id: string;
  payload: string;
  createdAt: number;
  /** Set on share deliveries; points at the original feed post. */
  parentMessageId?: string;
};

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

  const row = value as StoredMessage;
  if (
    row.parentMessageId !== undefined &&
    typeof row.parentMessageId !== 'string'
  ) {
    return null;
  }

  return row;
}

export async function saveStoredShare(
  shareCoreJson: string,
  keyManifest: KeyManifestMap,
  parentMessageId: string,
): Promise<StoredMessage> {
  const message: StoredMessage = {
    id: crypto.randomUUID(),
    payload: shareCoreJson,
    parentMessageId,
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

export async function listShareDeliveriesForParentMessage(
  parentMessageId: string,
): Promise<StoredMessage[]> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly');
    const store = tx.objectStore(MESSAGES_STORE);

    if (store.indexNames.contains(MESSAGES_PARENT_MESSAGE_ID_INDEX)) {
      const index = store.index(MESSAGES_PARENT_MESSAGE_ID_INDEX);
      const request = index.getAll(parentMessageId);
      request.onsuccess = () => {
        const rows = (request.result ?? [])
          .map(parseStoredMessage)
          .filter((row): row is StoredMessage => row !== null)
          .sort((a, b) => a.createdAt - b.createdAt);
        resolve(rows);
      };
      request.onerror = () => reject(request.error);
      return;
    }

    const request = store.getAll();
    request.onsuccess = () => {
      const rows = (request.result ?? [])
        .map(parseStoredMessage)
        .filter(
          (row): row is StoredMessage =>
            row !== null && row.parentMessageId === parentMessageId,
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredMessagesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredMessage[]> {
  const messageIds = await listMessageIdsForRecipientKeyId(recipientKeyId);
  const messages = await Promise.all(
    messageIds.map((id) => getStoredMessageById(id)),
  );
  const rows = messages.filter((row): row is StoredMessage => row !== null);

  const parentIds = new Set<string>();
  for (const message of rows) {
    if (isShareDelivery(message) && message.parentMessageId) {
      parentIds.add(message.parentMessageId);
    }
  }

  const existingIds = new Set(rows.map((message) => message.id));
  for (const parentId of parentIds) {
    if (existingIds.has(parentId)) {
      continue;
    }
    const parent = await getStoredMessageById(parentId);
    if (parent) {
      rows.push(parent);
      existingIds.add(parentId);
    }
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSenderKeyIdFromPayload(
  payload: string,
): Promise<string | null> {
  return getSenderKeyIdFromCorePayload(payload);
}

export { getMessageKeyManifestEntry };
