/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRON?: string;
  readonly VITE_CAPACITOR?: string;
  readonly VITE_ENCRYPT_PROTOCOL_DEEP_LINKS?: string;
  readonly VITE_FEED_LAB_HOSTNAME?: string;
  readonly VITE_FEED_LAB_DEV_HOSTNAME?: string;
  readonly VITE_FEED_LAB_PROTOCOL_BRIDGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export type ExternalFileMetadata = {
  path: string;
  name: string;
  size: number;
};

export type ExternalFileOpenedPayload =
  | (ExternalFileMetadata & { text: string })
  | (ExternalFileMetadata & { error: string });

export type ExternalTextImportPayload =
  | { sourceName: string; text: string; error?: undefined }
  | { sourceName: string; error: string; text?: undefined };

export type TrayAuthState = {
  canExportPublicKey?: boolean;
  publicKeyText?: string | null;
  isLoggedIn?: boolean;
  keyId?: string | null;
};

export type TrayRecipientsState = {
  usernames: string[];
};

export type TrayEncryptCopiedMessagePayload =
  | {
      username: string;
      plaintext: string;
      error?: undefined;
    }
  | {
      username: string;
      error: string;
      plaintext?: undefined;
    };

export type DeepLinkAction =
  | { type: 'copy-public-key' }
  | { type: 'encrypt'; text: string }
  | { type: 'decrypt'; text: string }
  | { type: 'feed-pair'; origin: string; session: string; callback: string }
  | {
      type: 'feed-op';
      session: string;
      requestId: string;
      op: string;
      payload: string;
    };

export type DeepLinkErrorPayload = {
  message: string;
};

export type ProtocolHandlerStatus = {
  applicable: boolean;
  isDefault: boolean;
  scheme: string;
  currentHandler?: string | null;
};

export type ProtocolHandlerRestoreResult = ProtocolHandlerStatus & {
  ok: boolean;
};

export type PickPrivateKeyJwkTextResult =
  | { cancelled: true; text?: undefined; error?: undefined }
  | { cancelled: false; text: string; error?: undefined }
  | { cancelled: false; error: string; text?: undefined };

export type PrivateKeySafeStorageReason = 'unavailable' | 'basic_text';

export type PrivateKeySafeStorageStatus = {
  available: boolean;
  backend: string | null;
  reason: PrivateKeySafeStorageReason | null;
};

export type StoredPrivateKeyJwkPayload = {
  keyId: string;
  jwkText: string;
};

export type PrivateKeySafeStorageSessionState = {
  phase: 'boot' | 'unlock' | 'locked';
  boundKeyId: string | null;
  isLoggedIn: boolean;
};

interface ElectronBridge {
  platform: NodeJS.Platform;
  onExternalFileOpened: (
    callback: (payload: ExternalFileOpenedPayload) => void,
  ) => () => void;
  onExternalTextImported: (
    callback: (payload: ExternalTextImportPayload) => void,
  ) => () => void;
  onTrayEncryptCopiedMessage: (
    callback: (payload: TrayEncryptCopiedMessagePayload) => void,
  ) => () => void;
  onTrayCopyPublicKey: (callback: () => void) => () => void;
  onDeepLinkActionRequest: (
    callback: (action: DeepLinkAction) => void,
  ) => () => void;
  onDeepLinkError: (
    callback: (payload: DeepLinkErrorPayload) => void,
  ) => () => void;
  consumePendingDeepLinkAction: () => Promise<DeepLinkAction | null>;
  getProtocolHandlerStatus: () => Promise<ProtocolHandlerStatus>;
  restoreDefaultProtocolHandler: () => Promise<ProtocolHandlerRestoreResult>;
  writeTextToClipboard: (text: string) => Promise<void>;
  dismissExternalFile: (filePath: string) => Promise<void>;
  pickPrivateKeyJwkText: () => Promise<PickPrivateKeyJwkTextResult>;
  privateKeySafeStorage: {
    getStatus: () => Promise<PrivateKeySafeStorageStatus>;
    beginSession: (keyId: string) => Promise<void>;
    has: (keyId: string) => Promise<boolean>;
    store: (keyId: string, jwkText: string) => Promise<void>;
    load: (keyId: string) => Promise<StoredPrivateKeyJwkPayload | null>;
    armSession: (keyId: string) => Promise<void>;
    getSessionState?: () => Promise<PrivateKeySafeStorageSessionState>;
    clearAllForCleanLocalData: () => Promise<void>;
  };
  showMainWindow: () => Promise<void>;
  hideMainWindow: () => Promise<void>;
  isMainWindowVisible: () => Promise<boolean>;
  flashTraySuccess: () => Promise<void>;
  openExternal: (
    url: string,
    options?: { background?: boolean },
  ) => Promise<void>;
  setAuthState?: (state: CapacitorAuthState) => void;
  setTrayAuthState: (state: TrayAuthState) => void;
  setTrayRecipients: (state: TrayRecipientsState) => void;
}

type CapacitorAuthState = {
  isLoggedIn: boolean;
  keyId?: string | null;
};

type PrivateKeySafeStorageBridge = ElectronBridge['privateKeySafeStorage'];

type CapacitorBridge = {
  saveTextFile: (text: string, filename: string) => Promise<string>;
  setAuthState: (state: CapacitorAuthState) => void;
  privateKeySafeStorage: PrivateKeySafeStorageBridge;
};

declare global {
  interface Window {
    electron?: ElectronBridge;
    capacitorBridge?: CapacitorBridge;
  }
}
