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

interface ElectronBridge {
  platform: NodeJS.Platform;
  onExternalFileOpened: (
    callback: (metadata: ExternalFileMetadata) => void,
  ) => () => void;
  readExternalFile: (filePath: string) => Promise<ExternalFileContent>;
  dismissExternalFile: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}
