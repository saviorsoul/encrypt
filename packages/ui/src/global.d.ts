/// <reference types="vite/client" />

interface Window {
  electron?: {
    writeTextToClipboard?: (text: string) => Promise<void>;
  };
}
