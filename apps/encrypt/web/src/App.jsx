import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/components/providers/AppProviders.tsx';
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
import { LocalDataRecoveryPage } from '@/pages/LocalDataRecoveryPage.tsx';
import { OnboardedRoute } from '@/components/routes/OnboardedRoute.tsx';
import { NotFoundPage } from '@/pages/NotFoundPage.tsx';

function App() {
  return (
    <AppProviders>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route
              path="save-private-key"
              element={<PrivateKeyDownloadPage />}
            />
            <Route
              path="recover-local-data"
              element={<LocalDataRecoveryPage />}
            />
            <Route element={<OnboardedRoute />}>
              <Route index element={<OneToOnePage />} />
              <Route path="feed" element={<FeedPage />} />
              <Route
                path="proof-of-concept"
                element={
                  <Navigate to="/proof-of-concepts/encrypt-decrypt" replace />
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
              <Route path="1-1" element={<Navigate to="/" replace />} />
              <Route path="glossary" element={<GlossaryPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AppProviders>
  );
}

export default App;
