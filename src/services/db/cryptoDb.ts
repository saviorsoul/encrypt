import { runDbMigrations } from './migrations/index.ts';

export const DB_NAME = 'crypto-db';
export const DB_VERSION = 8;
export const USERS_STORE = 'users';
export const USERS_USERNAME_INDEX = 'username';
export const MESSAGES_STORE = 'messages';
export const SHARES_STORE = 'shares';
export const SHARES_PARENT_MESSAGE_ID_INDEX = 'parentMessageId';
export const COMMENTS_STORE = 'comments';
export const COMMENTS_MESSAGE_ID_INDEX = 'messageId';
export const MESSAGE_KEY_MANIFEST_STORE = 'messageKeyManifest';
export const MESSAGE_KEY_MANIFEST_KEY_ID_INDEX = 'keyId';
export const MESSAGE_KEY_MANIFEST_MESSAGE_ID_INDEX = 'messageId';
export const ONE_TO_ONE_MESSAGES_STORE = 'oneToOneMessages';
export const ONE_TO_ONE_THREAD_KEY_INDEX = 'threadKey';

export function deleteCryptoDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to delete database'));
    request.onsuccess = () => resolve();
    request.onblocked = () => {
      window.location.reload();
    };
  });
}

export function openCryptoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(USERS_STORE)) {
        const usersStore = db.createObjectStore(USERS_STORE, {
          keyPath: 'keyId',
        });
        usersStore.createIndex(USERS_USERNAME_INDEX, 'username', {
          unique: true,
        });
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE, {
          keyPath: 'id',
        });
      }
      if (!db.objectStoreNames.contains(SHARES_STORE)) {
        const sharesStore = db.createObjectStore(SHARES_STORE, {
          keyPath: 'id',
        });
        sharesStore.createIndex(
          SHARES_PARENT_MESSAGE_ID_INDEX,
          'parentMessageId',
          { unique: false },
        );
      }
      if (!db.objectStoreNames.contains(COMMENTS_STORE)) {
        const commentsStore = db.createObjectStore(COMMENTS_STORE, {
          keyPath: 'id',
        });
        commentsStore.createIndex(COMMENTS_MESSAGE_ID_INDEX, 'messageId', {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains(MESSAGE_KEY_MANIFEST_STORE)) {
        const shardStore = db.createObjectStore(MESSAGE_KEY_MANIFEST_STORE, {
          keyPath: ['messageId', 'keyId'],
        });
        shardStore.createIndex(MESSAGE_KEY_MANIFEST_KEY_ID_INDEX, 'keyId', {
          unique: false,
        });
        shardStore.createIndex(
          MESSAGE_KEY_MANIFEST_MESSAGE_ID_INDEX,
          'messageId',
          {
            unique: false,
          },
        );
      }
      if (!db.objectStoreNames.contains(ONE_TO_ONE_MESSAGES_STORE)) {
        const oneToOneStore = db.createObjectStore(ONE_TO_ONE_MESSAGES_STORE, {
          keyPath: 'id',
        });
        oneToOneStore.createIndex(ONE_TO_ONE_THREAD_KEY_INDEX, 'threadKey', {
          unique: false,
        });
      }

      runDbMigrations({
        db,
        tx,
        oldVersion,
        newVersion: DB_VERSION,
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
