import type { PrivateKeySafeStorageBridge } from './types.ts';

declare global {
  interface Window {
    electron?: {
      pickPrivateKeyJwkText?: () => Promise<{
        cancelled?: boolean;
        error?: string;
        text?: string;
      }>;
      writeTextToClipboard?: (text: string) => Promise<void>;
      privateKeySafeStorage?: PrivateKeySafeStorageBridge;
      setAuthState?: (state: {
        isLoggedIn: boolean;
        keyId?: string | null;
      }) => void;
      setTrayAuthState?: (state: {
        isLoggedIn: boolean;
        keyId?: string | null;
        canExportPublicKey?: boolean;
        publicKeyText?: string | null;
      }) => void;
    };
    capacitorBridge?: {
      saveTextFile?: (text: string, filename: string) => Promise<string>;
      setAuthState?: (state: {
        isLoggedIn: boolean;
        keyId?: string | null;
      }) => void;
      privateKeySafeStorage?: PrivateKeySafeStorageBridge;
    };
  }
}

export type { PrivateKeySafeStorageBridge };
