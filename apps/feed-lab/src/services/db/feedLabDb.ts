export const DB_NAME = 'feed-lab-db';
export const DB_VERSION = 1;
export const USERS_STORE = 'users';
export const USERS_USERNAME_INDEX = 'username';

export function openFeedLabDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        const usersStore = db.createObjectStore(USERS_STORE, {
          keyPath: 'keyId',
        });
        usersStore.createIndex(USERS_USERNAME_INDEX, 'username', {
          unique: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
