/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ELECTRON?: string;
  readonly VITE_CAPACITOR?: string;
  readonly VITE_FEED_INVITATIONAL_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
