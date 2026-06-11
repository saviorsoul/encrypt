import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme } from '@/theme.ts';
import { KeysProvider } from '@/components/providers/KeysProvider.tsx';
import { AuthProvider } from '@/components/providers/AuthProvider.tsx';
import { AppLayout } from '@/components/layout/AppLayout.tsx';
import { ProtectedRoute } from '@/components/routes/ProtectedRoute.tsx';
import { LoginPage } from '@/pages/LoginPage.tsx';
import { FeedPage } from '@/pages/FeedPage.tsx';
import { ProofOfConceptPage } from '@/pages/ProofOfConceptPage.tsx';
import { ProofOfConceptFeedCommentPage } from '@/pages/ProofOfConceptFeedCommentPage.tsx';
import { OneToOnePage } from '@/pages/OneToOnePage.tsx';
import { GlossaryPage } from '@/pages/GlossaryPage.tsx';
import { PrivateKeyDownloadPage } from '@/pages/PrivateKeyDownloadPage.tsx';
import { OnboardedRoute } from '@/components/routes/OnboardedRoute.tsx';

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <KeysProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route
                    path="save-private-key"
                    element={<PrivateKeyDownloadPage />}
                  />
                  <Route element={<OnboardedRoute />}>
                    <Route index element={<FeedPage />} />
                    <Route
                      path="proof-of-concept"
                      element={
                        <Navigate to="/proof-of-concepts/feed" replace />
                      }
                    />
                    <Route
                      path="proof-of-concepts/feed"
                      element={<ProofOfConceptPage />}
                    />
                    <Route
                      path="proof-of-concepts/feed-comment"
                      element={<ProofOfConceptFeedCommentPage />}
                    />
                    <Route
                      path="proof-of-concepts/1-1"
                      element={<Navigate to="/1-1" replace />}
                    />
                    <Route path="1-1" element={<OneToOnePage />} />
                    <Route path="glossary" element={<GlossaryPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </KeysProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
