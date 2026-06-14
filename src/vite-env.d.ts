/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
