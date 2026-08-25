export type PrivateKeySafeStorageStatus = {
  available: boolean;
  backend: string | null;
  reason: string | null;
};

export type StoredPrivateKeyJwkPayload = {
  keyId: string;
  jwkText: string;
};

export type PrivateKeySafeStorageBridge = {
  getStatus: () => Promise<PrivateKeySafeStorageStatus>;
  beginSession: (keyId: string) => Promise<void>;
  has: (keyId: string) => Promise<boolean>;
  store: (keyId: string, jwkText: string) => Promise<void>;
  load: (keyId: string) => Promise<StoredPrivateKeyJwkPayload | null>;
  listPrivateKeyIds?: () => Promise<string[]>;
  loadSolePrivateKey?: () => Promise<StoredPrivateKeyJwkPayload | null>;
  armSession: (keyId: string) => Promise<void>;
  getSessionState?: () => Promise<unknown>;
  clearAllForCleanLocalData: () => Promise<void>;
};

export type TrayAuthState = {
  canExportPublicKey: boolean;
  publicKeyText: string | null;
  isLoggedIn: boolean;
  keyId?: string | null;
};

export interface PlatformAdapter {
  privateKey: {
    withUploadedPrivateKey<T>(
      fn: (
        material: import('@encrypt/core/crypto/privateKeyMaterial').UploadedPrivateKeyMaterial,
      ) => Promise<T>,
    ): Promise<T>;
    clearStorage(): void;
  };
}
