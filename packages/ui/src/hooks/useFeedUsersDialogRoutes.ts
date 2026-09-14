import { useCallback } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import type { IdentityDialogTarget } from '../components/IdentityDialog.tsx';
import {
  feedDialogRoutes,
  feedUsersDialogRoutePatterns,
} from '../lib/feedDialogRoutes.ts';

export function useFeedUsersDialogRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const identityMatch = useMatch(feedUsersDialogRoutePatterns.identity);
  const shareHistoryMatch = useMatch(feedUsersDialogRoutePatterns.shareHistory);
  const unfriendMatch = useMatch(feedUsersDialogRoutePatterns.unfriend);
  const acceptRequestMatch = useMatch(
    feedUsersDialogRoutePatterns.acceptRequest,
  );
  const publicKeyMatch = useMatch(feedUsersDialogRoutePatterns.publicKey);
  const invitationQrMatch = useMatch(feedUsersDialogRoutePatterns.invitationQr);
  const removeInvitationMatch = useMatch(
    feedUsersDialogRoutePatterns.removeInvitation,
  );
  const addFriendOpen =
    useMatch(feedUsersDialogRoutePatterns.addFriend) != null;
  const acceptInvitationOpen =
    useMatch(feedUsersDialogRoutePatterns.acceptInvitation) != null;
  const qrScanOpen =
    useMatch(feedUsersDialogRoutePatterns.scanInvitation) != null;

  const routedIdentityFromState = (
    location.state as { identity?: IdentityDialogTarget } | null
  )?.identity;

  const closeUsersDialog = useCallback(() => {
    navigate(feedDialogRoutes.users());
  }, [navigate]);

  return {
    routedIdentityKeyId: identityMatch?.params.keyId ?? null,
    shareHistoryKeyId: shareHistoryMatch?.params.keyId ?? null,
    unfriendKeyId: unfriendMatch?.params.keyId ?? null,
    acceptRequestKeyId: acceptRequestMatch?.params.keyId ?? null,
    publicKeyKeyId: publicKeyMatch?.params.keyId ?? null,
    invitationQrToken: invitationQrMatch?.params.token ?? null,
    removeInvitationToken: removeInvitationMatch?.params.token ?? null,
    addFriendOpen,
    acceptInvitationOpen,
    qrScanOpen,
    routedIdentityFromState,
    closeUsersDialog,
  };
}
