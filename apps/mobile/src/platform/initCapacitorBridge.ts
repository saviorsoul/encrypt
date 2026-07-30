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
} from '@/crypto/privateKeySafeStorageSession.ts';
import type {
  PrivateKeySafeStorageStatus,
  StoredPrivateKeyJwkPayload,
} from '@/vite-env.d.ts';

const PRIVATE_KEY_STORAGE_PREFIX = 'encrypt-pk-';

function privateKeyStorageKey(keyId: string): string {
  return `${PRIVATE_KEY_STORAGE_PREFIX}${keyId}`;
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
    key.startsWith(PRIVATE_KEY_STORAGE_PREFIX),
  );

  await Promise.all(
    privateKeyKeys.map((key) => SecureStoragePlugin.remove({ key })),
  );
  resetPrivateKeySafeStorageSession();
}

export function initCapacitorBridge(): void {
  if (!Capacitor.isNativePlatform()) {
    return;
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
        return `On My iPhone/Encrypt/Documents/${filename}`;
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
