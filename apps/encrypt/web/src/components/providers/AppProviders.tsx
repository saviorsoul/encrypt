import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme } from '@/theme.ts';
import { KeysProvider } from '@/components/providers/KeysProvider.tsx';
import { AuthProvider } from '@/components/providers/AuthProvider.tsx';
import { ExternalFileProvider } from '@/components/providers/ExternalFileProvider.tsx';
import { ElectronTraySync } from '@/components/providers/ElectronTraySync.tsx';
import { PrivateKeyWarmup } from '@/components/providers/PrivateKeyWarmup.tsx';
import { CapacitorPrivateKeyAuthSync } from '@/components/providers/PlatformPrivateKeyAuthSync.tsx';
import { ElectronDesktopEncryptHandler } from '@/components/providers/ElectronDesktopEncryptHandler.tsx';
import { ElectronDeepLinkHandler } from '@/components/providers/ElectronDeepLinkHandler.tsx';
import { FeedLabBridgeHandler } from '@/components/providers/FeedLabBridgeHandler.tsx';
import { SessionPrivateKeyProvider } from '@/components/providers/SessionPrivateKeyProvider.tsx';
import { StoragePersistenceProvider } from '@/components/providers/StoragePersistenceProvider.tsx';
import { ProtocolHandlerProvider } from '@/components/providers/ProtocolHandlerProvider.tsx';
import { isFeedLabProtocolBridgeEnabled } from '@encrypt/core/feed/feedLabBridgeConfig';

const isElectron = Boolean(import.meta.env.VITE_ELECTRON);
const isCapacitor = Boolean(import.meta.env.VITE_CAPACITOR);
const isNativeShell = isElectron || isCapacitor;
const feedLabProtocolBridgeEnabled = isFeedLabProtocolBridgeEnabled();

const Router = isNativeShell ? HashRouter : BrowserRouter;

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const routerProps = isNativeShell
    ? {}
    : { basename: import.meta.env.BASE_URL };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router {...routerProps}>
        <AuthProvider>
          <StoragePersistenceProvider>
            <SessionPrivateKeyProvider>
              <KeysProvider>
                <ProtocolHandlerProvider>
                  <ExternalFileProvider>
                    {isNativeShell ? (
                      <>
                        <PrivateKeyWarmup />
                        {isCapacitor ? <CapacitorPrivateKeyAuthSync /> : null}
                        {feedLabProtocolBridgeEnabled ? (
                          <FeedLabBridgeHandler />
                        ) : null}
                      </>
                    ) : null}
                    {isElectron ? (
                      <>
                        <ElectronTraySync />
                        <ElectronDesktopEncryptHandler />
                        <ElectronDeepLinkHandler />
                      </>
                    ) : null}
                    {children}
                  </ExternalFileProvider>
                </ProtocolHandlerProvider>
              </KeysProvider>
            </SessionPrivateKeyProvider>
          </StoragePersistenceProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}
