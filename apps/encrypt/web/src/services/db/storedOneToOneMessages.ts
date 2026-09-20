import {
  ONE_TO_ONE_MESSAGES_STORE,
  ONE_TO_ONE_THREAD_KEY_INDEX,
  openCryptoDb,
} from './cryptoDb.ts';
import type { OneToOneThreadItem, ThreadSide } from '@/types/oneToOne.ts';

export type StoredOneToOneMessage = {
  id: string;
  threadKey: string;
  senderKeyId: string;
  recipientKeyId: string;
  createdAt: number;
  encryptedAt: number;
  encryptedPayload: string;
};

export function oneToOneThreadKey(
  partyKeyIdA: string,
  partyKeyIdB: string,
): string {
  return partyKeyIdA < partyKeyIdB
    ? `${partyKeyIdA}:${partyKeyIdB}`
    : `${partyKeyIdB}:${partyKeyIdA}`;
}

/** Whether the message author is the viewing user (shown on the right). */
export function threadSideForViewer(
  message: Pick<StoredOneToOneMessage, 'senderKeyId'>,
  viewerKeyId: string,
): ThreadSide {
  return message.senderKeyId === viewerKeyId ? 'sender' : 'recipient';
}

export function storedMessageToThreadItem(
  message: StoredOneToOneMessage,
  viewerKeyId: string,
): OneToOneThreadItem {
  return {
    id: message.id,
    createdAt: message.createdAt,
    encryptedAt: message.encryptedAt,
    side: threadSideForViewer(message, viewerKeyId),
    encryptedPayload: message.encryptedPayload,
  };
}

export function threadItemToStoredMessage(
  item: OneToOneThreadItem,
  viewerKeyId: string,
  peerKeyId: string,
  senderKeyId: string,
  recipientKeyId: string,
): StoredOneToOneMessage {
  return {
    id: item.id,
    threadKey: oneToOneThreadKey(viewerKeyId, peerKeyId),
    senderKeyId,
    recipientKeyId,
    createdAt: item.createdAt,
    encryptedAt: item.encryptedAt,
    encryptedPayload: item.encryptedPayload,
  };
}

/** Resolve manifest sender/recipient key ids from encryptor side and party key ids. */
export function messagePartyKeyIds(
  encryptorSide: ThreadSide,
  partySenderKeyId: string,
  partyRecipientKeyId: string,
): { senderKeyId: string; recipientKeyId: string } {
  const encryptorKeyId =
    encryptorSide === 'sender' ? partySenderKeyId : partyRecipientKeyId;
  const peerKeyId =
    encryptorSide === 'sender' ? partyRecipientKeyId : partySenderKeyId;
  return { senderKeyId: encryptorKeyId, recipientKeyId: peerKeyId };
}

function parseStoredOneToOneMessage(
  value: unknown,
): StoredOneToOneMessage | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as StoredOneToOneMessage).id !== 'string' ||
    typeof (value as StoredOneToOneMessage).threadKey !== 'string' ||
    typeof (value as StoredOneToOneMessage).senderKeyId !== 'string' ||
    typeof (value as StoredOneToOneMessage).recipientKeyId !== 'string' ||
    typeof (value as StoredOneToOneMessage).createdAt !== 'number' ||
    typeof (value as StoredOneToOneMessage).encryptedAt !== 'number' ||
    typeof (value as StoredOneToOneMessage).encryptedPayload !== 'string'
  ) {
    return null;
  }

  return value as StoredOneToOneMessage;
}

export async function saveOneToOneMessage(
  message: StoredOneToOneMessage,
): Promise<void> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ONE_TO_ONE_MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(ONE_TO_ONE_MESSAGES_STORE);
    store.put(message);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOneToOneMessagesForThread(
  viewerKeyId: string,
  peerKeyId: string,
): Promise<StoredOneToOneMessage[]> {
  const db = await openCryptoDb();
  const threadKey = oneToOneThreadKey(viewerKeyId, peerKeyId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ONE_TO_ONE_MESSAGES_STORE, 'readonly');
    const store = tx.objectStore(ONE_TO_ONE_MESSAGES_STORE);
    const index = store.index(ONE_TO_ONE_THREAD_KEY_INDEX);
    const request = index.getAll(threadKey);

    request.onsuccess = () => {
      const rows = (request.result ?? [])
        .map(parseStoredOneToOneMessage)
        .filter((row): row is StoredOneToOneMessage => row !== null)
        .sort((a, b) => b.encryptedAt - a.encryptedAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadOneToOneThread(
  viewerKeyId: string,
  peerKeyId: string,
): Promise<OneToOneThreadItem[]> {
  const stored = await listOneToOneMessagesForThread(viewerKeyId, peerKeyId);
  return stored.map((message) =>
    storedMessageToThreadItem(message, viewerKeyId),
  );
}
