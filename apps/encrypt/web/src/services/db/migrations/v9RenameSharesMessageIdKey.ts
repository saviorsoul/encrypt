import { SHARES_MESSAGE_ID_INDEX, SHARES_STORE } from '../cryptoDb.ts';
import { rewriteObjectStore } from './helpers.ts';
import type { DbMigration } from './types.ts';

const LEGACY_SHARES_PARENT_MESSAGE_ID_INDEX = 'parentMessageId';

export const v9RenameSharesMessageIdKey: DbMigration = {
  version: 9,
  name: 'Rename shares parentMessageId key/index to messageId',
  upgrade({ tx }) {
    const sharesStore = tx.objectStore(SHARES_STORE);

    rewriteObjectStore<Record<string, unknown>>(sharesStore, (record) => {
      if (typeof record.messageId === 'string' && record.messageId) {
        if ('parentMessageId' in record) {
          const rest = { ...record };
          delete rest.parentMessageId;
          return rest;
        }
        return record;
      }

      const parentMessageId = record.parentMessageId;
      if (typeof parentMessageId !== 'string' || !parentMessageId) {
        return null;
      }

      const rest = { ...record };
      delete rest.parentMessageId;
      return { ...rest, messageId: parentMessageId };
    });

    if (
      sharesStore.indexNames.contains(LEGACY_SHARES_PARENT_MESSAGE_ID_INDEX)
    ) {
      sharesStore.deleteIndex(LEGACY_SHARES_PARENT_MESSAGE_ID_INDEX);
    }
    if (!sharesStore.indexNames.contains(SHARES_MESSAGE_ID_INDEX)) {
      sharesStore.createIndex(SHARES_MESSAGE_ID_INDEX, 'messageId', {
        unique: false,
      });
    }
  },
};
