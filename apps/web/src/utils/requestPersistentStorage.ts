/**
 * Ask the browser to exempt this origin from automatic storage eviction.
 * Browsers may still deny the request; failures are ignored.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const { storage } = navigator;
    if (!storage?.persist) {
      return false;
    }

    if (storage.persisted) {
      const alreadyPersistent = await storage.persisted();
      if (alreadyPersistent) {
        return true;
      }
    }

    return await storage.persist();
  } catch {
    return false;
  }
}
