import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme } from '@/theme.ts';
import { KeysProvider } from '@/components/providers/KeysProvider.tsx';
import { AuthProvider } from '@/components/providers/AuthProvider.tsx';
import { ExternalFileProvider } from '@/components/providers/ExternalFileProvider.tsx';
import { ElectronTraySync } from '@/components/providers/ElectronTraySync.tsx';
import { ElectronTrayEncryptHandler } from '@/components/providers/ElectronTrayEncryptHandler.tsx';
import { SessionPrivateKeyProvider } from '@/components/providers/SessionPrivateKeyProvider.tsx';
import { StoragePersistenceProvider } from '@/components/providers/StoragePersistenceProvider.tsx';

const Router = import.meta.env.VITE_ELECTRON ? HashRouter : BrowserRouter;

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const routerProps = import.meta.env.VITE_ELECTRON
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
                {import.meta.env.VITE_ELECTRON ? (
                  <>
                    <ElectronTraySync />
                    <ElectronTrayEncryptHandler />
                  </>
                ) : null}
                <ExternalFileProvider>{children}</ExternalFileProvider>
              </KeysProvider>
            </SessionPrivateKeyProvider>
          </StoragePersistenceProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}
