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

export type ExternalFileContent = ExternalFileMetadata & {
  text: string;
};

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

export type PickPrivateKeyJwkTextResult =
  | { cancelled: true; text?: undefined; error?: undefined }
  | { cancelled: false; text: string; error?: undefined }
  | { cancelled: false; error: string; text?: undefined };

interface ElectronBridge {
  platform: NodeJS.Platform;
  onExternalFileOpened: (
    callback: (metadata: ExternalFileMetadata) => void,
  ) => () => void;
  onExternalTextImported: (
    callback: (payload: ExternalTextImportPayload) => void,
  ) => () => void;
  onTrayEncryptCopiedMessage: (
    callback: (payload: TrayEncryptCopiedMessagePayload) => void,
  ) => () => void;
  readExternalFile: (filePath: string) => Promise<ExternalFileContent>;
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
