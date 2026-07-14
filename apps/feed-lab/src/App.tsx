import { Navigate, Route, Routes } from 'react-router-dom';
import { FeedLabRouter } from '@lab/lib/feedLabRouter.ts';
import { ProtectedRoute } from '@lab/components/routes/ProtectedRoute.tsx';
import { FeedApiProvider } from '@lab/providers/FeedApiProvider.tsx';
import { FeedLabSessionProvider } from '@lab/providers/FeedLabSessionProvider.tsx';
import { FeedLabSettingsProvider } from '@lab/providers/FeedLabSettingsProvider.tsx';
import { FeedLabThemeProvider } from '@lab/providers/FeedLabThemeProvider.tsx';
import { SignNetworkRequestProvider } from '@lab/providers/SignNetworkRequestProvider.tsx';
import { FeedLabLayout } from '@lab/layout/FeedLabLayout.tsx';
import { FeedPage } from '@lab/pages/FeedPage.tsx';
import { InvitePage } from '@lab/pages/InvitePage.tsx';
import { LoginPage } from '@lab/pages/LoginPage.tsx';

export default function App() {
  return (
    <FeedLabSessionProvider>
      <FeedLabSettingsProvider>
        <FeedLabThemeProvider>
          <SignNetworkRequestProvider>
            <FeedApiProvider>
              <FeedLabRouter>
                <Routes>
                  <Route path="login" element={<LoginPage />} />
                  <Route path="invite/:token" element={<InvitePage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<FeedLabLayout />}>
                      <Route index element={<Navigate to="/feed" replace />} />
                      <Route path="feed" element={<FeedPage />} />
                      <Route path="users" element={<FeedPage />} />
                    </Route>
                  </Route>
                </Routes>
              </FeedLabRouter>
            </FeedApiProvider>
          </SignNetworkRequestProvider>
        </FeedLabThemeProvider>
      </FeedLabSettingsProvider>
    </FeedLabSessionProvider>
  );
}
