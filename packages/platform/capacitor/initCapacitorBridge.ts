import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  armPrivateKeySafeStorageSession,
  assertPrivateKeySafeStorageHas,
  assertPrivateKeySafeStorageLoad,
  assertPrivateKeySafeStorageStore,
  beginPrivateKeySafeStorageSession,
  getPrivateKeySafeStorageSessionState,
  resetPrivateKeySafeStorageSession,
  setPrivateKeySafeStorageAuthState,
} from '../src/privateKeySafeStorageSession.ts';
import type {
  PrivateKeySafeStorageStatus,
  StoredPrivateKeyJwkPayload,
} from '../src/types.ts';

export type InitCapacitorBridgeOptions = {
  storageKeyPrefix?: string;
  documentsPathLabel?: string;
};

export function initCapacitorBridge(
  options: InitCapacitorBridgeOptions = {},
): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const storageKeyPrefix = options.storageKeyPrefix ?? 'encrypt-pk-';
  const documentsPathLabel =
    options.documentsPathLabel ?? 'On My iPhone/Encrypt/Documents';

  function privateKeyStorageKey(keyId: string): string {
    return `${storageKeyPrefix}${keyId}`;
  }

  async function secureStorageHas(keyId: string): Promise<boolean> {
    try {
      await SecureStoragePlugin.get({ key: privateKeyStorageKey(keyId) });
      return true;
    } catch {
      return false;
    }
  }

  async function clearSecureStoragePrivateKeys(): Promise<void> {
    const { value: keys } = await SecureStoragePlugin.keys();
    const privateKeyKeys = keys.filter((key) =>
      key.startsWith(storageKeyPrefix),
    );

    await Promise.all(
      privateKeyKeys.map((key) => SecureStoragePlugin.remove({ key })),
    );
    resetPrivateKeySafeStorageSession();
  }

  const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

  async function listPrivateKeyIds(): Promise<string[]> {
    const { value: keys } = await SecureStoragePlugin.keys();
    return keys
      .filter((key) => key.startsWith(storageKeyPrefix))
      .map((key) => key.slice(storageKeyPrefix.length))
      .filter((keyId) => KEY_ID_PATTERN.test(keyId));
  }

  async function loadSolePrivateKey(): Promise<StoredPrivateKeyJwkPayload | null> {
    const keyIds = await listPrivateKeyIds();
    if (keyIds.length !== 1) {
      return null;
    }

    const keyId = keyIds[0]!;
    try {
      const { value } = await SecureStoragePlugin.get({
        key: privateKeyStorageKey(keyId),
      });
      if (!value) {
        return null;
      }
      return { keyId, jwkText: value };
    } catch {
      return null;
    }
  }

  window.capacitorBridge = {
    saveTextFile: async (text: string, filename: string): Promise<string> => {
      const directory = Directory.Documents;

      await Filesystem.writeFile({
        path: filename,
        data: text,
        directory,
        encoding: Encoding.UTF8,
      });

      if (Capacitor.getPlatform() === 'android') {
        return `Documents/${filename}`;
      }

      if (Capacitor.getPlatform() === 'ios') {
        return `${documentsPathLabel}/${filename}`;
      }

      return `Documents/${filename}`;
    },
    setAuthState: (state) => {
      setPrivateKeySafeStorageAuthState(state);
    },
    privateKeySafeStorage: {
      getStatus: async (): Promise<PrivateKeySafeStorageStatus> => ({
        available: true,
        backend: Capacitor.getPlatform(),
        reason: null,
      }),
      beginSession: async (keyId: string) => {
        beginPrivateKeySafeStorageSession(keyId);
      },
      has: async (keyId: string) => {
        assertPrivateKeySafeStorageHas(keyId);
        return secureStorageHas(keyId);
      },
      store: async (keyId: string, jwkText: string) => {
        assertPrivateKeySafeStorageStore(keyId);
        await SecureStoragePlugin.set({
          key: privateKeyStorageKey(keyId),
          value: jwkText,
        });
      },
      load: async (
        keyId: string,
      ): Promise<StoredPrivateKeyJwkPayload | null> => {
        assertPrivateKeySafeStorageLoad(keyId);
        try {
          const { value } = await SecureStoragePlugin.get({
            key: privateKeyStorageKey(keyId),
          });
          if (!value) {
            return null;
          }
          return { keyId, jwkText: value };
        } catch {
          return null;
        }
      },
      listPrivateKeyIds,
      loadSolePrivateKey,
      armSession: async (keyId: string) => {
        armPrivateKeySafeStorageSession(keyId);
      },
      getSessionState: async () => getPrivateKeySafeStorageSessionState(),
      clearAllForCleanLocalData: async () => {
        await clearSecureStoragePrivateKeys();
      },
    },
  };
}
