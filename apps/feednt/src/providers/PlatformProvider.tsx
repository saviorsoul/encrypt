import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { PlatformAdapter } from '@encrypt/platform';

const PlatformContext = createContext<PlatformAdapter | null>(null);

export function PlatformProvider({
  platform,
  children,
}: {
  platform: PlatformAdapter;
  children: ReactNode;
}) {
  return (
    <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformAdapter {
  const platform = useContext(PlatformContext);
  if (!platform) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return platform;
}

export function usePlatformPrivateKey() {
  const platform = usePlatform();
  return useMemo(() => platform.privateKey, [platform]);
}

export function useWithUploadedPrivateKey() {
  const privateKey = usePlatformPrivateKey();
  return useCallback(
    <T,>(fn: Parameters<typeof privateKey.withUploadedPrivateKey<T>>[0]) =>
      privateKey.withUploadedPrivateKey(fn),
    [privateKey],
  );
}
