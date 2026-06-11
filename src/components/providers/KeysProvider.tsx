import React, { createContext, type ReactNode } from 'react';
import { useKeys } from '@/hooks/useKeys.ts';

export type KeysContextValue = {
  loading: boolean;
  publicKey: CryptoKey | null;
  publicKeyJwk: JsonWebKey | null;
  needsPrivateKeyDownload: boolean;
  privateKeySaved: boolean;
  pendingPrivateKeyJwk: JsonWebKey | null;
  privateKeyDownloadFilename: string | null;
  ensurePendingPrivateKey: () => Promise<void>;
  downloadPendingPrivateKey: () => Promise<void>;
};

export const KeysContext = createContext<KeysContextValue | null>(null);

export function KeysProvider({ children }: { children: ReactNode }) {
  const keys = useKeys();

  return <KeysContext value={keys}>{children}</KeysContext>;
}
