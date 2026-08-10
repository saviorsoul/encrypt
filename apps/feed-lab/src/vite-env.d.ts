/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** When set, bridge callback tabs stay open instead of calling window.close(). */
  readonly VITE_FEED_LAB_KEEP_CALLBACK_TAB?: string;
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
