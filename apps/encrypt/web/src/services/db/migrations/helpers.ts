/**
 * Rewrites every record in an object store inside an upgrade transaction.
 * Return `null` from `rewrite` to delete a record.
 */
export function rewriteObjectStore<T extends Record<string, unknown>>(
  store: IDBObjectStore,
  rewrite: (record: T) => T | null,
): void {
  const request = store.openCursor();

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) {
      return;
    }

    const next = rewrite(cursor.value as T);
    if (next === null) {
      cursor.delete();
    } else {
      cursor.update(next);
    }
    cursor.continue();
  };
}
