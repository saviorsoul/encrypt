/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BROWSER_ROUTER: string;
  readonly VITE_FEED_INVITATIONAL_ONLY?: string;
  readonly VITE_FEED_LAB_KEEP_CALLBACK_TAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
