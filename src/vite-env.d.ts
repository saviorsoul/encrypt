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
};

export type KeyboardShortcutsMap = Record<string, string>;

export type KeyboardShortcutsState = {
  shortcuts: KeyboardShortcutsMap;
  registration: Record<string, boolean>;
  sessionType: string;
};

interface ElectronBridge {
  platform: NodeJS.Platform;
  onExternalFileOpened: (
    callback: (metadata: ExternalFileMetadata) => void,
  ) => () => void;
  onExternalTextImported: (
    callback: (payload: ExternalTextImportPayload) => void,
  ) => () => void;
  readExternalFile: (filePath: string) => Promise<ExternalFileContent>;
  dismissExternalFile: (filePath: string) => Promise<void>;
  setTrayAuthState: (state: TrayAuthState) => void;
  getKeyboardShortcutsState: () => Promise<KeyboardShortcutsState>;
  setKeyboardShortcut: (
    id: string,
    accelerator: string,
  ) => Promise<KeyboardShortcutsState>;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}
