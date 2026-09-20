import { MESSAGES_STORE, SHARES_STORE } from '../cryptoDb.ts';
import type { DbMigration } from './types.ts';

const LEGACY_MESSAGES_PARENT_MESSAGE_ID_INDEX = 'parentMessageId';

type MessageRow = {
  id: string;
  payload: string;
  createdAt: number;
};

function parseMessageRow(value: Record<string, unknown>): MessageRow | null {
  if (
    typeof value.id !== 'string' ||
    typeof value.payload !== 'string' ||
    typeof value.createdAt !== 'number'
  ) {
    return null;
  }

  return {
    id: value.id,
    payload: value.payload,
    createdAt: value.createdAt,
  };
}

export const v8MoveSharesToSharesTable: DbMigration = {
  version: 8,
  name: 'Move share deliveries from messages to shares table',
  upgrade({ db, tx }) {
    const messagesStore = tx.objectStore(MESSAGES_STORE);
    const sharesStore = tx.objectStore(SHARES_STORE);
    const hadParentMessageIdIndex = messagesStore.indexNames.contains(
      LEGACY_MESSAGES_PARENT_MESSAGE_ID_INDEX,
    );
    const keptMessages: MessageRow[] = [];
    const request = messagesStore.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        if (!hadParentMessageIdIndex) {
          return;
        }

        db.deleteObjectStore(MESSAGES_STORE);
        const newMessagesStore = db.createObjectStore(MESSAGES_STORE, {
          keyPath: 'id',
        });
        for (const message of keptMessages) {
          newMessagesStore.put(message);
        }
        return;
      }

      const value = cursor.value as Record<string, unknown>;
      const parentMessageId = value.parentMessageId;
      if (typeof parentMessageId === 'string' && parentMessageId) {
        sharesStore.put({
          id: value.id,
          parentMessageId,
          payload: value.payload,
          createdAt: value.createdAt,
        });
        cursor.delete();
        cursor.continue();
        return;
      }

      const message = parseMessageRow(value);
      if (!message) {
        cursor.delete();
        cursor.continue();
        return;
      }

      if (hadParentMessageIdIndex) {
        keptMessages.push(message);
        cursor.delete();
      } else if ('parentMessageId' in value) {
        cursor.update(message);
      }

      cursor.continue();
    };
  },
};
