/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAPACITOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
