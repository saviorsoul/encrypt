import {
  openCryptoDb,
  COMMENTS_STORE,
  COMMENTS_MESSAGE_ID_INDEX,
} from './cryptoDb.ts';
import { getStoredMessageById } from './storedMessages.ts';
import { parseCommentPayload } from '@/crypto/commentCrypto.ts';
import { canCommentOnParentMessage } from '@/crypto/manifestShare.ts';

export type StoredComment = {
  id: string;
  messageId: string;
  payload: string;
  createdAt: number;
};

function parseStoredComment(value: unknown): StoredComment | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as StoredComment).id !== 'string' ||
    typeof (value as StoredComment).messageId !== 'string' ||
    typeof (value as StoredComment).payload !== 'string' ||
    typeof (value as StoredComment).createdAt !== 'number'
  ) {
    return null;
  }

  return value as StoredComment;
}

export async function saveStoredComment(
  messageId: string,
  payload: string,
): Promise<StoredComment> {
  const parentMessage = await getStoredMessageById(messageId);
  if (!parentMessage) {
    throw new Error(`Message not found: ${messageId}`);
  }

  const comment: StoredComment = {
    id: crypto.randomUUID(),
    messageId,
    payload,
    createdAt: Date.now(),
  };

  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMENTS_STORE, 'readwrite');
    const store = tx.objectStore(COMMENTS_STORE);

    store.put(comment);

    tx.oncomplete = () => resolve(comment);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listCommentsForMessage(
  messageId: string,
): Promise<StoredComment[]> {
  const db = await openCryptoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMENTS_STORE, 'readonly');
    const store = tx.objectStore(COMMENTS_STORE);
    const index = store.index(COMMENTS_MESSAGE_ID_INDEX);
    const request = index.getAll(messageId);

    request.onsuccess = () => {
      const rows = (request.result ?? [])
        .map(parseStoredComment)
        .filter((row): row is StoredComment => row !== null)
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function commentVisibleToRecipient(
  messageId: string,
  payload: string,
  recipientKeyId: string,
): Promise<boolean> {
  try {
    const parsed = parseCommentPayload(payload);
    if (parsed.parentMessageId !== messageId) {
      return false;
    }
  } catch {
    return false;
  }

  return canCommentOnParentMessage(messageId, recipientKeyId);
}
