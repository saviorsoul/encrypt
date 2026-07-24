/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRON?: string;
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
  canExportPublicKey: boolean;
  publicKeyText: string | null;
  isLoggedIn: boolean;
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
  | { type: 'decrypt'; text: string };

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
  showMainWindow: () => Promise<void>;
  flashTraySuccess: () => Promise<void>;
  setTrayAuthState: (state: TrayAuthState) => void;
  setTrayRecipients: (state: TrayRecipientsState) => void;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}
