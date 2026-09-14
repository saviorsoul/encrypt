import { useCallback } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import type { IdentityDialogTarget } from '../components/IdentityDialog.tsx';
import {
  createMessageDialogOpenFromPathname,
  feedDialogRoutes,
  feedPageDialogRoutePatterns,
} from '../lib/feedDialogRoutes.ts';

export function useFeedPageDialogRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const identityMatch = useMatch(feedPageDialogRoutePatterns.identity);
  const shareMatch = useMatch(feedPageDialogRoutePatterns.share);
  const addFriendOpen = useMatch(feedPageDialogRoutePatterns.addFriend) != null;
  const acceptInvitationOpen =
    useMatch(feedPageDialogRoutePatterns.acceptInvitation) != null;
  const qrScanOpen =
    useMatch(feedPageDialogRoutePatterns.scanInvitation) != null;

  const shareMessageId = shareMatch?.params.messageId ?? null;
  const routedIdentityFromState = (
    location.state as { identity?: IdentityDialogTarget } | null
  )?.identity;

  const closeFeedDialog = useCallback(() => {
    navigate(feedDialogRoutes.feed());
  }, [navigate]);

  return {
    routedIdentityKeyId: identityMatch?.params.keyId ?? null,
    routedIdentityFromState,
    createMessageDialogOpen: createMessageDialogOpenFromPathname(
      location.pathname,
    ),
    shareMessageId,
    shareDialogOpen: shareMessageId != null,
    addFriendOpen,
    acceptInvitationOpen,
    qrScanOpen,
    closeFeedDialog,
  };
}
