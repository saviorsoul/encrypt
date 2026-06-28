import {
  COMMENTS_MESSAGE_ID_INDEX,
  COMMENTS_OLD_V9_STORE,
  COMMENTS_STORE,
} from '../cryptoDb.ts';
import type { DbMigration } from './types.ts';

export const v10ArchiveCommentsToOldTable: DbMigration = {
  version: 10,
  name: 'Archive legacy comments to comments_old_v9',
  upgrade({ db, tx, oldVersion }) {
    if (oldVersion === 0) {
      return;
    }

    const commentsStore = tx.objectStore(COMMENTS_STORE);
    const countRequest = commentsStore.count();

    countRequest.onsuccess = () => {
      if (countRequest.result === 0) {
        return;
      }

      if (!db.objectStoreNames.contains(COMMENTS_OLD_V9_STORE)) {
        const archiveStore = db.createObjectStore(COMMENTS_OLD_V9_STORE, {
          keyPath: 'id',
        });
        archiveStore.createIndex(COMMENTS_MESSAGE_ID_INDEX, 'messageId', {
          unique: false,
        });
      }

      const archiveStore = tx.objectStore(COMMENTS_OLD_V9_STORE);
      const request = commentsStore.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          return;
        }

        archiveStore.put(cursor.value);
        cursor.delete();
        cursor.continue();
      };
    };
  },
};
