import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FeedApiProvider } from '@lab/providers/FeedApiProvider.tsx';
import { FeedLabSessionProvider } from '@lab/providers/FeedLabSessionProvider.tsx';
import { FeedLabSettingsProvider } from '@lab/providers/FeedLabSettingsProvider.tsx';
import { FeedLabThemeProvider } from '@lab/providers/FeedLabThemeProvider.tsx';
import { SignNetworkRequestProvider } from '@lab/providers/SignNetworkRequestProvider.tsx';
import { FeedLabLayout } from '@lab/layout/FeedLabLayout.tsx';
import { FeedPage } from '@lab/pages/FeedPage.tsx';
import { UsersPage } from '@lab/pages/UsersPage.tsx';
import { InvitePage } from '@lab/pages/InvitePage.tsx';

export default function App() {
  return (
    <FeedLabSessionProvider>
      <FeedLabSettingsProvider>
        <FeedLabThemeProvider>
          <SignNetworkRequestProvider>
            <FeedApiProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<FeedLabLayout />}>
                    <Route index element={<Navigate to="/feed" replace />} />
                    <Route path="feed" element={<FeedPage />} />
                    <Route path="users" element={<UsersPage />} />
                  </Route>
                  <Route path="invite/:token" element={<InvitePage />} />
                </Routes>
              </BrowserRouter>
            </FeedApiProvider>
          </SignNetworkRequestProvider>
        </FeedLabThemeProvider>
      </FeedLabSettingsProvider>
    </FeedLabSessionProvider>
  );
}
