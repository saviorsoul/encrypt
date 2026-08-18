import { Navigate, Route, Routes } from 'react-router-dom';
import {
  SendMessageDependenciesProvider,
  type SendMessageDependencies,
} from '@encrypt/ui';
import { ProtectedRoute } from '@feednt/components/routes/ProtectedRoute.tsx';
import { FeedntLayout } from '@feednt/layout/FeedntLayout.tsx';
import {
  FeedApiProvider,
  useFeedApi,
} from '@feednt/providers/FeedApiProvider.tsx';
import { FeedntSessionProvider } from '@feednt/providers/FeedntSessionProvider.tsx';
import { FeedntSettingsProvider } from '@feednt/providers/FeedntSettingsProvider.tsx';
import { FeedntThemeProvider } from '@feednt/providers/FeedntThemeProvider.tsx';
import { FeedPage } from '@feednt/pages/FeedPage.tsx';
import { InvitePage } from '@feednt/pages/InvitePage.tsx';
import { LoginPage } from '@feednt/pages/LoginPage.tsx';

const feedntSendMessageDependencies: SendMessageDependencies = {
  useFeedApi,
};

export function App() {
  return (
    <FeedntSessionProvider>
      <FeedntSettingsProvider>
        <FeedntThemeProvider>
          <FeedApiProvider>
            <SendMessageDependenciesProvider
              value={feedntSendMessageDependencies}
            >
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/invite/:token" element={<InvitePage />} />
                  <Route element={<FeedntLayout />}>
                    <Route path="/feed" element={<FeedPage />} />
                    <Route path="/users" element={<FeedPage />} />
                    <Route path="/" element={<Navigate to="/feed" replace />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </SendMessageDependenciesProvider>
          </FeedApiProvider>
        </FeedntThemeProvider>
      </FeedntSettingsProvider>
    </FeedntSessionProvider>
  );
}
