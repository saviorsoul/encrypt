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

export type TrayAuthState = {
  canExportPublicKey: boolean;
  publicKeyText: string | null;
};

interface ElectronBridge {
  platform: NodeJS.Platform;
  onExternalFileOpened: (
    callback: (metadata: ExternalFileMetadata) => void,
  ) => () => void;
  readExternalFile: (filePath: string) => Promise<ExternalFileContent>;
  dismissExternalFile: (filePath: string) => Promise<void>;
  setTrayAuthState: (state: TrayAuthState) => void;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}
