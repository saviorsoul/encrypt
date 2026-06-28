import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme } from '@/theme.ts';
import { KeysProvider } from '@/components/providers/KeysProvider.tsx';
import { AuthProvider } from '@/components/providers/AuthProvider.tsx';
import { AppLayout } from '@/components/layout/AppLayout.tsx';
import { ProtectedRoute } from '@/components/routes/ProtectedRoute.tsx';
import { LoginPage } from '@/pages/LoginPage.tsx';
import { FeedPage } from '@/pages/FeedPage.tsx';
import { ProofOfConceptEncryptDecryptPage } from '@/pages/ProofOfConceptEncryptDecryptPage';
import { ProofOfConceptFeedCommentPage } from '@/pages/ProofOfConceptFeedCommentPage.tsx';
import { ProofOfConceptFeedSharePage } from '@/pages/ProofOfConceptFeedSharePage.tsx';
import { OneToOnePage } from '@/pages/OneToOnePage.tsx';
import { GlossaryPage } from '@/pages/GlossaryPage.tsx';
import { PrivateKeyDownloadPage } from '@/pages/PrivateKeyDownloadPage.tsx';
import { OnboardedRoute } from '@/components/routes/OnboardedRoute.tsx';
import { ExternalFileProvider } from '@/components/providers/ExternalFileProvider.tsx';
import { ElectronTraySync } from '@/components/providers/ElectronTraySync.tsx';
import { ElectronTrayEncryptHandler } from '@/components/providers/ElectronTrayEncryptHandler.tsx';
import { SessionPrivateKeyProvider } from '@/components/providers/SessionPrivateKeyProvider.tsx';
import { NotFoundPage } from '@/pages/NotFoundPage.tsx';

const Router = import.meta.env.VITE_ELECTRON ? HashRouter : BrowserRouter;

function App() {
  const routerProps = import.meta.env.VITE_ELECTRON
    ? {}
    : { basename: import.meta.env.BASE_URL };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router {...routerProps}>
        <AuthProvider>
          <SessionPrivateKeyProvider>
            <KeysProvider>
              {import.meta.env.VITE_ELECTRON ? (
                <>
                  <ElectronTraySync />
                  <ElectronTrayEncryptHandler />
                </>
              ) : null}
              <ExternalFileProvider>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="login" element={<LoginPage />} />
                    <Route element={<ProtectedRoute />}>
                      <Route
                        path="save-private-key"
                        element={<PrivateKeyDownloadPage />}
                      />
                      <Route element={<OnboardedRoute />}>
                        <Route index element={<OneToOnePage />} />
                        <Route path="feed" element={<FeedPage />} />
                        <Route
                          path="proof-of-concept"
                          element={
                            <Navigate
                              to="/proof-of-concepts/encrypt-decrypt"
                              replace
                            />
                          }
                        />
                        <Route
                          path="proof-of-concepts/encrypt-decrypt"
                          element={<ProofOfConceptEncryptDecryptPage />}
                        />
                        <Route
                          path="proof-of-concepts/feed-comment"
                          element={<ProofOfConceptFeedCommentPage />}
                        />
                        <Route
                          path="proof-of-concepts/feed-share"
                          element={<ProofOfConceptFeedSharePage />}
                        />
                        <Route
                          path="proof-of-concepts/1-1"
                          element={<Navigate to="/" replace />}
                        />
                        <Route
                          path="1-1"
                          element={<Navigate to="/" replace />}
                        />
                        <Route path="glossary" element={<GlossaryPage />} />
                      </Route>
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </ExternalFileProvider>
            </KeysProvider>
          </SessionPrivateKeyProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
