/// <reference types="vite/client" />
/// <reference path="../../../packages/platform/src/global.d.ts" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ELECTRON?: string;
  readonly VITE_CAPACITOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
