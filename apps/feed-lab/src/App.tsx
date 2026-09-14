import { Navigate, Route, Routes } from 'react-router-dom';
import {
  SendMessageDependenciesProvider,
  type SendMessageDependencies,
} from '@encrypt/ui';
import { FeedLabRouter } from '@lab/lib/feedLabRouter.ts';
import { ProtectedRoute } from '@lab/components/routes/ProtectedRoute.tsx';
import { isBridgeCancellationError } from '@lab/crypto/systemAppSigner.ts';
import {
  FeedApiProvider,
  useFeedApi,
} from '@lab/providers/FeedApiProvider.tsx';
import { FeedLabSessionProvider } from '@lab/providers/FeedLabSessionProvider.tsx';
import { FeedLabSettingsProvider } from '@lab/providers/FeedLabSettingsProvider.tsx';
import { FeedLabThemeProvider } from '@lab/providers/FeedLabThemeProvider.tsx';
import { SignNetworkRequestProvider } from '@lab/providers/SignNetworkRequestProvider.tsx';
import { EncryptAppDeepLinkProvider } from '@lab/providers/EncryptAppDeepLinkProvider.tsx';
import { FeedLabLayout } from '@lab/layout/FeedLabLayout.tsx';
import { FeedPage } from '@lab/pages/FeedPage.tsx';
import { InvitePage } from '@lab/pages/InvitePage.tsx';
import { LoginPage } from '@lab/pages/LoginPage.tsx';
import {
  BridgeCallbackPage,
  BridgePairCallbackPage,
} from '@lab/pages/BridgeCallbackPage.tsx';
import { useSystemAppBridgeListener } from '@lab/hooks/useSystemAppBridgeListener.ts';

const feedLabSendMessageDependencies: SendMessageDependencies = {
  useFeedApi,
  isSendCancellationError: isBridgeCancellationError,
};

function FeedLabRoutes() {
  useSystemAppBridgeListener();

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="invite/:token" element={<InvitePage />} />
      <Route path="bridge-callback" element={<BridgeCallbackPage />} />
      <Route path="bridge-callback/pair" element={<BridgePairCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<FeedLabLayout />}>
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="create-message" element={<FeedPage />} />
          <Route path="share/:messageId" element={<FeedPage />} />
          <Route path="identity/:keyId" element={<FeedPage />} />
          <Route path="add-friend" element={<FeedPage />} />
          <Route path="accept-invitation" element={<FeedPage />} />
          <Route path="scan-invitation" element={<FeedPage />} />
          <Route path="users" element={<FeedPage />} />
          <Route path="users/identity/:keyId" element={<FeedPage />} />
          <Route path="users/share-history/:keyId" element={<FeedPage />} />
          <Route path="users/unfriend/:keyId" element={<FeedPage />} />
          <Route path="users/add-friend" element={<FeedPage />} />
          <Route path="users/accept-invitation" element={<FeedPage />} />
          <Route path="users/scan-invitation" element={<FeedPage />} />
          <Route path="users/accept-request/:keyId" element={<FeedPage />} />
          <Route path="users/public-key/:keyId" element={<FeedPage />} />
          <Route path="users/invitation-qr/:token" element={<FeedPage />} />
          <Route path="users/remove-invitation/:token" element={<FeedPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <FeedLabSessionProvider>
      <FeedLabSettingsProvider>
        <FeedLabThemeProvider>
          <SignNetworkRequestProvider>
            <EncryptAppDeepLinkProvider>
              <FeedApiProvider>
                <SendMessageDependenciesProvider
                  value={feedLabSendMessageDependencies}
                >
                  <FeedLabRouter>
                    <FeedLabRoutes />
                  </FeedLabRouter>
                </SendMessageDependenciesProvider>
              </FeedApiProvider>
            </EncryptAppDeepLinkProvider>
          </SignNetworkRequestProvider>
        </FeedLabThemeProvider>
      </FeedLabSettingsProvider>
    </FeedLabSessionProvider>
  );
}
