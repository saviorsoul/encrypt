import {
  openCryptoDb,
  MESSAGES_STORE,
  MESSAGE_KEY_MANIFEST_STORE,
} from '@/crypto/cryptoDb.ts';
import { getSenderKeyIdFromCorePayload } from '@/crypto/manifestDecrypt.ts';
import { splitManifestForStorage } from '@/crypto/manifestStorage.ts';
import { putMessageKeyManifestShardsInTransaction } from '@/crypto/storedMessageKeyManifest.ts';
import {
  getMessageKeyManifestEntry,
  listMessageIdsForRecipientKeyId,
} from '@/crypto/storedMessageKeyManifest.ts';

export type StoredMessage = {
  id: string;
  payload: string;
  createdAt: number;
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

  return value as StoredMessage;
}

export async function saveStoredMessage(
  fullPayload: string,
): Promise<StoredMessage> {
  const { corePayloadJson, keyManifest } = splitManifestForStorage(fullPayload);
  const message: StoredMessage = {
    id: crypto.randomUUID(),
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

export async function listStoredMessagesForRecipientKeyId(
  recipientKeyId: string,
): Promise<StoredMessage[]> {
  const messageIds = await listMessageIdsForRecipientKeyId(recipientKeyId);
  const messages = await Promise.all(
    messageIds.map((id) => getStoredMessageById(id)),
  );
  return messages
    .filter((row): row is StoredMessage => row !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSenderKeyIdFromPayload(
  payload: string,
): Promise<string | null> {
  return getSenderKeyIdFromCorePayload(payload);
}

export { getMessageKeyManifestEntry };
