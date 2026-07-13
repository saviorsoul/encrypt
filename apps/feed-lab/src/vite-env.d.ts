/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electron?: {
    writeTextToClipboard?: (text: string) => Promise<void>;
    pickPrivateKeyJwkText?: () => Promise<{
      cancelled?: boolean;
      error?: string;
      text?: string;
    }>;
  };
}
