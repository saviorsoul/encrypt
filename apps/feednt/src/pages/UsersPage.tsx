import React, { useCallback, useMemo, useRef, useState } from 'react';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useFeedApi } from '@feednt/providers/FeedApiProvider.tsx';
import { useFeedntFriendships } from '@feednt/providers/FeedntFriendshipsProvider.tsx';
import { useBackendFriendshipRequests } from '@feednt/hooks/useBackendFriendshipRequests.ts';
import {
  AcceptFriendRequestDialog,
  type PendingFriendRequest,
} from '@feednt/components/AcceptFriendRequestDialog.tsx';
import { AddFriendDialog } from '@feednt/components/AddFriendDialog.tsx';
import { PublicKeyDialog } from '@feednt/components/PublicKeyDialog.tsx';
import { UnfriendConfirmDialog } from '@feednt/components/UnfriendConfirmDialog.tsx';
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { InvitationQrCodeDialog } from '@encrypt/ui/InvitationQrCodeDialog';
import { AcceptInvitationDialog } from '@encrypt/ui/AcceptInvitationDialog';
import { RemoveInvitationConfirmDialog } from '@encrypt/ui';
import { FeedntInvitationQrScan } from '@feednt/components/FeedntInvitationQrScan.tsx';
import { useBackendFriendInvitations } from '@feednt/hooks/useBackendFriendInvitations.ts';
import { formatEcPublicKeyText } from '@encrypt/core/crypto/ecPublicKey';
import {
  IdentityDialog,
  useIdentityDialog,
  useFeedUsersDialogRoutes,
  feedDialogRoutes,
  UsersCollapsibleSection,
  type IdentityDialogTarget,
} from '@encrypt/ui';
import { useCopiedToClipboardSnackbar } from '@encrypt/ui/useCopiedToClipboardSnackbar';
import {
  saveFeedntUser,
  loadFeedntUserByKeyId,
} from '@feednt/services/db/storedUsers.ts';
import { FriendNameField } from '@feednt/components/FriendNameField.tsx';
import { InvitationLabelField } from '@feednt/components/InvitationLabelField.tsx';
import {
  formatCommentAuthorLabel,
  formatFriendListEntry,
} from '@feednt/lib/formatCommentAuthorLabel.ts';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';
import { ShareMessageHistoryDialog } from '@encrypt/ui/ShareMessageHistoryDialog';
import { useBackendShareMessageHistory } from '@feednt/hooks/useBackendShareMessageHistory.ts';
import { isUnknownUserKeyIdError } from '@encrypt/core/utils/apiRegistrationError';
import { isFeedInvitationalOnlyEnabled } from '@encrypt/ui';

export function UsersPage() {
  const navigate = useNavigate();
  const api = useFeedApi();
  const { keys, feedntUsers } = useFeedntSession();
  const { addLocalUser, usernameByKeyId, usernames } = feedntUsers;
  const {
    routedIdentityKeyId,
    shareHistoryKeyId,
    unfriendKeyId,
    acceptRequestKeyId,
    publicKeyKeyId,
    invitationQrToken,
    removeInvitationToken,
    addFriendOpen: addFriendDialogOpen,
    acceptInvitationOpen,
    qrScanOpen,
    routedIdentityFromState,
    closeUsersDialog,
  } = useFeedUsersDialogRoutes();

  const [acceptFriendError, setAcceptFriendError] = useState<string | null>(
    null,
  );
  const [acceptFriendBusy, setAcceptFriendBusy] = useState(false);
  const [unfriendError, setUnfriendError] = useState<string | null>(null);
  const unfriendSucceededRef = useRef(false);
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const friendships = useFeedntFriendships();
  const shareMessageHistory = useBackendShareMessageHistory(keys, keys.keyId);
  const feedInvitationalOnly = isFeedInvitationalOnlyEnabled();
  const isRegistered =
    keys.keyId != null &&
    (!feedInvitationalOnly ||
      !(
        friendships.friendshipsError &&
        isUnknownUserKeyIdError(friendships.friendshipsError, keys.keyId)
      ));

  const refreshFriendData = useCallback(async () => {
    await friendships.refresh({ force: true });
  }, [friendships]);

  const friendInvitations = useBackendFriendInvitations(refreshFriendData);

  const friendshipRequests = useBackendFriendshipRequests(
    refreshFriendData,
    (user) => {
      addLocalUser(user);
    },
  );

  const resolveIdentityByKeyId = useCallback(
    (keyId: string): IdentityDialogTarget | null => {
      const friend = friendships.friends.find((entry) => entry.keyId === keyId);
      if (friend) {
        return {
          keyId: friend.keyId,
          publicKey: friend.publicKey,
          label:
            usernameByKeyId[friend.keyId]?.trim() ||
            friend.label ||
            friend.keyId,
        };
      }
      const request = friendships.incomingRequests.find(
        (entry) => entry.requesterKeyId === keyId,
      );
      if (request?.publicKey) {
        return {
          keyId,
          publicKey: request.publicKey,
          label:
            usernameByKeyId[keyId]?.trim() ||
            formatCommentAuthorLabel(keyId, usernameByKeyId),
        };
      }
      return null;
    },
    [friendships.friends, friendships.incomingRequests, usernameByKeyId],
  );

  const acceptFriendRequest = useMemo((): PendingFriendRequest | null => {
    const keyId = acceptRequestKeyId;
    if (!keyId) {
      return null;
    }
    const request = friendships.incomingRequests.find(
      (entry) => entry.requesterKeyId === keyId,
    );
    if (!request) {
      return null;
    }
    return {
      requesterKeyId: request.requesterKeyId,
      targetKeyId: request.targetKeyId,
    };
  }, [acceptRequestKeyId, friendships.incomingRequests]);

  const viewPublicKey = useMemo(() => {
    const keyId = publicKeyKeyId;
    if (!keyId) {
      return null;
    }
    const request = friendships.incomingRequests.find(
      (entry) => entry.requesterKeyId === keyId,
    );
    return request?.publicKey ?? null;
  }, [friendships.incomingRequests, publicKeyKeyId]);

  const qrCodeToken = invitationQrToken;

  const removeInvitationTarget = useMemo(() => {
    const token = removeInvitationToken;
    if (!token) {
      return null;
    }
    const invitation = friendships.pendingInvitations.find(
      (entry) => entry.token === token,
    );
    if (!invitation) {
      return null;
    }
    return {
      token: invitation.token,
      label: invitation.label,
    };
  }, [friendships.pendingInvitations, removeInvitationToken]);

  const unfriendTarget = useMemo(() => {
    const keyId = unfriendKeyId;
    if (!keyId) {
      return null;
    }
    const friend = friendships.friends.find((entry) => entry.keyId === keyId);
    if (!friend) {
      return null;
    }
    return {
      keyId: friend.keyId,
      label: usernameByKeyId[friend.keyId]?.trim() || friend.label,
    };
  }, [friendships.friends, unfriendKeyId, usernameByKeyId]);

  const shareHistoryTarget = useMemo(() => {
    const keyId = shareHistoryKeyId;
    if (!keyId) {
      return null;
    }
    const friend = friendships.friends.find((entry) => entry.keyId === keyId);
    if (!friend) {
      return null;
    }
    return {
      keyId: friend.keyId,
      name: usernameByKeyId[friend.keyId]?.trim() || null,
      publicKey: friend.publicKey,
    };
  }, [friendships.friends, shareHistoryKeyId, usernameByKeyId]);

  const identity = useIdentityDialog({
    keyId: keys.keyId,
    usernameByKeyId,
    addLocalUser,
    friendKeyIds: friendships.friendKeyIds,
    saveLocalUser: async (ownerKeyId, username, publicKey) => {
      await saveFeedntUser(ownerKeyId, username, {
        kty: 'EC',
        crv: 'P-256',
        x: publicKey.x,
        y: publicKey.y,
      });
    },
    friendshipsLoading: friendships.friendshipsLoading,
    friendshipsError: friendships.friendshipsError,
    busy: friendshipRequests.busy,
    error: friendshipRequests.error,
    info: friendshipRequests.info,
    onClearError: friendshipRequests.clearError,
    onCancelInFlight: friendshipRequests.cancelInFlight,
    routedKeyId: routedIdentityKeyId,
    routedIdentity:
      routedIdentityFromState?.keyId === routedIdentityKeyId
        ? routedIdentityFromState
        : null,
    resolveIdentityByKeyId,
    onOpenIdentity: (target) => {
      friendshipRequests.clearError();
      friendshipRequests.clearInfo();
      void friendships.ensureFriendshipsLoaded();
      navigate(feedDialogRoutes.usersIdentity(target.keyId), {
        state: { identity: target },
      });
    },
    onCloseIdentity: () => {
      friendshipRequests.cancelInFlight();
      closeUsersDialog();
    },
    onAddFriend: async (name, target) => {
      if (!keys.keyId) {
        return { ok: false };
      }
      return friendshipRequests.sendRequestByPublicKey(
        keys.keyId,
        formatEcPublicKeyText(target.publicKey),
        name,
        usernames,
        usernameByKeyId,
      );
    },
    getFriendMute: friendships.getFriendMute,
    onToggleFriendMute: friendships.toggleFriendDeliveryMute,
  });

  const handleAcceptFriendWithName = useCallback(
    async (username: string, shareHistory: boolean) => {
      if (!acceptFriendRequest || !keys.keyId || acceptFriendBusy) {
        return;
      }

      setAcceptFriendError(null);
      setAcceptFriendBusy(true);
      const { requesterKeyId } = acceptFriendRequest;

      try {
        const storedUser = await loadFeedntUserByKeyId(
          keys.keyId,
          requesterKeyId,
        );
        const acceptError =
          await friendshipRequests.acceptRequest(requesterKeyId);
        if (acceptError) {
          setAcceptFriendError(acceptError);
          return;
        }

        let publicJwk: JsonWebKey;
        if (storedUser) {
          publicJwk = storedUser.publicJwk;
        } else {
          const friendshipsList = await api.getFriendships();
          const friend = friendshipsList.find(
            (entry) => entry.friendKeyId === requesterKeyId,
          );
          if (!friend) {
            setAcceptFriendError('Could not load friend public key.');
            await refreshFriendData();
            return;
          }
          publicJwk = {
            kty: 'EC',
            crv: 'P-256',
            x: friend.publicKey.x,
            y: friend.publicKey.y,
          };
        }

        try {
          await saveFeedntUser(keys.keyId, username, publicJwk);
          addLocalUser({ keyId: requesterKeyId, username });
          if (shareHistory) {
            const shared = await shareMessageHistory.shareHistoryWithFriend({
              keyId: requesterKeyId,
              publicKey: {
                x: String(publicJwk.x),
                y: String(publicJwk.y),
              },
            });
            if (!shared && shareMessageHistory.error) {
              setAcceptFriendError(shareMessageHistory.error);
              return;
            }
          }
          closeUsersDialog();
        } catch (e) {
          setAcceptFriendError(
            e instanceof Error ? e.message : 'Failed to accept friend request.',
          );
        } finally {
          await refreshFriendData();
        }
      } finally {
        setAcceptFriendBusy(false);
      }
    },
    [
      acceptFriendBusy,
      acceptFriendRequest,
      addLocalUser,
      api,
      closeUsersDialog,
      friendshipRequests,
      keys.keyId,
      refreshFriendData,
      shareMessageHistory,
    ],
  );

  const handleUnfriendConfirm = useCallback(async () => {
    if (!unfriendTarget || !keys.keyId || friendshipRequests.busy) {
      return;
    }

    setUnfriendError(null);
    const error = await friendshipRequests.unfriend(unfriendTarget.keyId);
    if (error) {
      setUnfriendError(error);
      return;
    }
    unfriendSucceededRef.current = true;
    closeUsersDialog();
  }, [closeUsersDialog, friendshipRequests, keys.keyId, unfriendTarget]);

  const openAddFriendDialog = useCallback(() => {
    friendInvitations.clearError();
    friendInvitations.clearLastInvitationId();
    friendshipRequests.clearError();
    friendshipRequests.clearInfo();
    navigate(feedDialogRoutes.usersAddFriend());
  }, [friendInvitations, friendshipRequests, navigate]);

  const handleSendRequestByPublicKey = useCallback(
    async (publicKeyText: string, name: string) => {
      if (!keys.keyId) {
        return { ok: false };
      }
      return friendshipRequests.sendRequestByPublicKey(
        keys.keyId,
        publicKeyText,
        name,
        usernames,
        usernameByKeyId,
      );
    },
    [friendshipRequests, keys.keyId, usernameByKeyId, usernames],
  );

  const handleQrTokenScanned = useCallback(
    (token: string) => {
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  const handleQrScanRequest = useCallback(() => {
    navigate(feedDialogRoutes.usersScanInvitation());
  }, [navigate]);

  const handleInvitationIdSubmit = useCallback(
    (token: string) => {
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  const handleRemoveInvitationConfirm = useCallback(async () => {
    if (!removeInvitationTarget) {
      return;
    }
    const removed = await friendInvitations.removeInvitation(
      removeInvitationTarget.token,
    );
    if (removed) {
      closeUsersDialog();
    }
  }, [closeUsersDialog, friendInvitations, removeInvitationTarget]);

  const outgoingInvitationTokens = new Set(
    friendships.outgoingRequests.map((request) => request.invitationToken),
  );
  const shareablePendingInvitations = friendships.pendingInvitations.filter(
    (invitation) => !outgoingInvitationTokens.has(invitation.token),
  );
  const invitationLabels = shareablePendingInvitations
    .map((invitation) => invitation.label?.trim())
    .filter((label): label is string => Boolean(label));
  const existingLocalNames = [...usernames, ...invitationLabels];

  const usersInitialLoading =
    keys.keyId != null && friendships.usersLoading && !friendships.usersHasData;
  const usersRefreshing =
    keys.keyId != null && friendships.usersLoading && friendships.usersHasData;

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ position: 'relative' }} aria-busy={usersRefreshing}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="h6">Friends</Typography>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                data-testid="users-accept-invitation"
                variant="outlined"
                size="small"
                disabled={!keys.keyId}
                onClick={() =>
                  navigate(feedDialogRoutes.usersAcceptInvitation())
                }
              >
                Enter code
              </Button>
              <Button
                data-testid="users-add-friend"
                variant="contained"
                size="small"
                disabled={
                  !keys.keyId || friendInvitations.busy || !isRegistered
                }
                onClick={openAddFriendDialog}
              >
                Invite friend
              </Button>
            </Stack>
          </Stack>

          {!keys.keyId ? (
            <Typography variant="body2" color="text.secondary">
              Authenticate with your private key to manage friendships.
            </Typography>
          ) : usersInitialLoading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading friendships…</Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              {friendships.incomingRequests.length > 0 ? (
                <UsersCollapsibleSection title="Incoming requests">
                  {friendships.incomingRequests.map((request) => {
                    const localName =
                      usernameByKeyId[request.requesterKeyId]?.trim() || null;
                    return (
                      <Stack
                        key={`${request.requesterKeyId}-${request.targetKeyId}`}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center' }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {localName ? (
                            <Typography
                              variant="body2"
                              sx={{ overflowWrap: 'anywhere' }}
                            >
                              {localName}
                            </Typography>
                          ) : null}
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ alignItems: 'center', minWidth: 0 }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                            >
                              {request.requesterKeyId}
                            </Typography>
                            {request.publicKey ? (
                              <IconButton
                                size="small"
                                aria-label="Show public key"
                                onClick={() => {
                                  if (request.publicKey) {
                                    navigate(
                                      feedDialogRoutes.usersPublicKey(
                                        request.requesterKeyId,
                                      ),
                                    );
                                  }
                                }}
                                sx={{ flexShrink: 0 }}
                              >
                                <KeyOutlinedIcon fontSize="inherit" />
                              </IconButton>
                            ) : null}
                          </Stack>
                        </Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexShrink: 0 }}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            disabled={friendshipRequests.busy}
                            onClick={() => {
                              setAcceptFriendError(null);
                              friendshipRequests.clearError();
                              navigate(
                                feedDialogRoutes.usersAcceptRequest(
                                  request.requesterKeyId,
                                ),
                              );
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={friendshipRequests.busy}
                            onClick={() =>
                              void friendshipRequests.rejectRequest(
                                request.requesterKeyId,
                              )
                            }
                          >
                            Reject
                          </Button>
                        </Stack>
                      </Stack>
                    );
                  })}
                </UsersCollapsibleSection>
              ) : null}

              {friendships.outgoingRequests.length > 0 ? (
                <UsersCollapsibleSection
                  title={`Outgoing requests (${friendships.outgoingRequests.length})`}
                  defaultExpanded={false}
                >
                  {friendships.outgoingRequests.map((request) => {
                    const entry = formatFriendListEntry(
                      request.targetKeyId,
                      usernameByKeyId,
                      friendships.invitationLabelByToken[
                        request.invitationToken
                      ],
                    );
                    return (
                      <Box
                        key={`${request.requesterKeyId}-${request.targetKeyId}`}
                      >
                        <Typography variant="body2">{entry.primary}</Typography>
                        {entry.secondary ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {entry.secondary}
                          </Typography>
                        ) : null}
                      </Box>
                    );
                  })}
                </UsersCollapsibleSection>
              ) : null}

              {shareablePendingInvitations.length > 0 ? (
                <UsersCollapsibleSection
                  title={`Pending invitations (${shareablePendingInvitations.length})`}
                  defaultExpanded={false}
                >
                  {shareablePendingInvitations.map((invitation) => (
                    <Stack
                      key={invitation.token}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center' }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {keys.keyId ? (
                          <InvitationLabelField
                            token={invitation.token}
                            ownerKeyId={keys.keyId}
                            storedLabel={invitation.label}
                            existingNames={existingLocalNames}
                            onSaved={(label) =>
                              friendships.updateInvitationLabel(
                                invitation.token,
                                label,
                              )
                            }
                          />
                        ) : (
                          <Typography variant="body2">
                            {invitation.label ?? 'Unnamed invitation'}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', overflowWrap: 'anywhere' }}
                        >
                          {invitation.token}
                        </Typography>
                      </Box>
                      <Tooltip title="Show invitation QR code">
                        <IconButton
                          size="small"
                          aria-label="Show invitation QR code"
                          onClick={() =>
                            navigate(
                              feedDialogRoutes.usersInvitationQr(
                                invitation.token,
                              ),
                            )
                          }
                          sx={{ flexShrink: 0 }}
                        >
                          <QrCode2OutlinedIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy invitation ID">
                        <IconButton
                          size="small"
                          aria-label="Copy invitation ID"
                          onClick={() => void copyAndNotify(invitation.token)}
                          sx={{ flexShrink: 0 }}
                        >
                          <ContentCopyOutlinedIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove invitation">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Remove invitation"
                            data-testid="users-remove-invitation"
                            disabled={friendInvitations.busy}
                            onClick={() =>
                              navigate(
                                feedDialogRoutes.usersRemoveInvitation(
                                  invitation.token,
                                ),
                              )
                            }
                            sx={{ flexShrink: 0 }}
                          >
                            <CloseOutlinedIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  ))}
                </UsersCollapsibleSection>
              ) : null}

              <UsersCollapsibleSection
                title={`Your friends (${friendships.friends.length})`}
              >
                {friendships.friends.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No friends yet. Accept an invitation from someone else to
                    get started — you need at least one friend before you can
                    invite others.
                  </Typography>
                ) : (
                  friendships.friends.map((friend) => {
                    return (
                      <Stack
                        key={friend.keyId}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', minWidth: 0 }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <FriendNameField
                            friendKeyId={friend.keyId}
                            label={friend.label}
                            storedUsername={usernameByKeyId[friend.keyId]}
                            publicKey={friend.publicKey}
                            ownerKeyId={keys.keyId!}
                            existingUsernames={usernames}
                            disabled={friendshipRequests.busy}
                            onSaved={addLocalUser}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            title={friend.keyId}
                            sx={{
                              display: 'block',
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {friend.keyId}
                          </Typography>
                        </Box>
                        {friend.messageHistorySharedAt ? null : (
                          <Tooltip title="Share history">
                            <span>
                              <IconButton
                                size="small"
                                aria-label="Share history"
                                disabled={
                                  friendshipRequests.busy ||
                                  !keys.keyId ||
                                  shareMessageHistory.busy
                                }
                                sx={{ flexShrink: 0 }}
                                onClick={() => {
                                  shareMessageHistory.clearError();
                                  navigate(
                                    feedDialogRoutes.usersShareHistory(
                                      friend.keyId,
                                    ),
                                  );
                                }}
                              >
                                <HistoryOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <Tooltip title="User info">
                          <span>
                            <IconButton
                              size="small"
                              aria-label="User info"
                              disabled={friendshipRequests.busy}
                              sx={{ flexShrink: 0 }}
                              onClick={() =>
                                identity.openIdentity({
                                  keyId: friend.keyId,
                                  publicKey: friend.publicKey,
                                  label:
                                    usernameByKeyId[friend.keyId]?.trim() ||
                                    friend.label ||
                                    friend.keyId,
                                })
                              }
                            >
                              <ManageAccountsOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Unfriend">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="Unfriend"
                              disabled={friendshipRequests.busy || !keys.keyId}
                              sx={{ flexShrink: 0 }}
                              onClick={() => {
                                if (!keys.keyId) {
                                  return;
                                }
                                setUnfriendError(null);
                                friendshipRequests.clearError();
                                navigate(
                                  feedDialogRoutes.usersUnfriend(friend.keyId),
                                );
                              }}
                            >
                              <PersonRemoveOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    );
                  })
                )}
              </UsersCollapsibleSection>
            </Stack>
          )}
          {usersRefreshing ? (
            <Box
              aria-hidden
              sx={(theme) => ({
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                cursor: 'wait',
                bgcolor: alpha(theme.palette.background.paper, 0.72),
              })}
            />
          ) : null}
        </Box>

        {friendships.usersError ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {friendships.usersError}
          </Alert>
        ) : null}
      </Paper>

      <CopiedToClipboardSnackbar {...snackbarProps} />

      <AddFriendDialog
        open={addFriendDialogOpen}
        authenticated={keys.keyId != null}
        isRegistered={isRegistered}
        hasFriends={friendships.friends.length > 0}
        invitationBusy={friendInvitations.busy}
        invitationError={friendInvitations.error}
        invitationId={friendInvitations.lastInvitationId}
        requestBusy={friendshipRequests.busy}
        requestError={friendshipRequests.error}
        requestInfo={friendshipRequests.info}
        onClose={closeUsersDialog}
        onClearInvitationError={friendInvitations.clearError}
        onClearRequestError={friendshipRequests.clearError}
        onCancelInFlight={friendshipRequests.cancelInFlight}
        onCreateInvitation={(name) =>
          void friendInvitations.createInvitation(name)
        }
        onSendRequestByPublicKey={handleSendRequestByPublicKey}
      />

      <AcceptFriendRequestDialog
        open={acceptFriendRequest != null}
        request={acceptFriendRequest}
        requesterLabel={
          acceptFriendRequest
            ? formatCommentAuthorLabel(
                acceptFriendRequest.requesterKeyId,
                usernameByKeyId,
              )
            : ''
        }
        suggestedUsername={
          acceptFriendRequest
            ? (usernameByKeyId[acceptFriendRequest.requesterKeyId] ?? '')
            : ''
        }
        existingUsernameForRequester={
          acceptFriendRequest
            ? (usernameByKeyId[acceptFriendRequest.requesterKeyId] ?? '')
            : ''
        }
        existingUsernames={usernames}
        busy={
          friendshipRequests.busy ||
          acceptFriendBusy ||
          shareMessageHistory.busy
        }
        error={acceptFriendError}
        onClose={() => {
          if (
            !friendshipRequests.busy &&
            !acceptFriendBusy &&
            !shareMessageHistory.busy
          ) {
            closeUsersDialog();
            setAcceptFriendError(null);
          }
        }}
        onAccept={handleAcceptFriendWithName}
        onClearError={() => setAcceptFriendError(null)}
      />

      <UnfriendConfirmDialog
        open={unfriendTarget != null}
        friendName={unfriendTarget?.label ?? ''}
        busy={friendshipRequests.busy}
        error={unfriendError}
        onClose={() => {
          if (!friendshipRequests.busy) {
            closeUsersDialog();
          }
        }}
        onExited={() => {
          const shouldRefresh = unfriendSucceededRef.current;
          unfriendSucceededRef.current = false;
          setUnfriendError(null);
          if (shouldRefresh) {
            void refreshFriendData();
          }
        }}
        onConfirm={() => void handleUnfriendConfirm()}
        onClearError={() => setUnfriendError(null)}
      />

      <PublicKeyDialog
        open={viewPublicKey != null}
        publicKey={viewPublicKey}
        title="Public key"
        onClose={closeUsersDialog}
      />

      <IdentityDialog {...identity.dialogProps} />

      {qrCodeToken ? (
        <InvitationQrCodeDialog
          open={qrCodeToken != null}
          token={qrCodeToken}
          onClose={closeUsersDialog}
        />
      ) : null}

      <RemoveInvitationConfirmDialog
        open={removeInvitationTarget != null}
        invitationLabel={removeInvitationTarget?.label ?? null}
        busy={friendInvitations.busy}
        error={friendInvitations.error}
        onClose={closeUsersDialog}
        onConfirm={() => void handleRemoveInvitationConfirm()}
        onClearError={friendInvitations.clearError}
      />

      <AcceptInvitationDialog
        open={acceptInvitationOpen}
        onClose={closeUsersDialog}
        onSubmit={handleInvitationIdSubmit}
        qrScanAvailable
        onQrScanRequest={handleQrScanRequest}
      />

      <FeedntInvitationQrScan
        open={qrScanOpen}
        onClose={closeUsersDialog}
        onTokenScanned={handleQrTokenScanned}
      />

      <ShareMessageHistoryDialog
        open={shareHistoryTarget != null}
        friendName={shareHistoryTarget?.name}
        friendKeyId={shareHistoryTarget?.keyId ?? ''}
        busy={shareMessageHistory.busy}
        error={shareMessageHistory.error}
        progress={shareMessageHistory.progress}
        onClose={() => {
          if (!shareMessageHistory.busy) {
            closeUsersDialog();
          }
        }}
        onClearError={shareMessageHistory.clearError}
        onClearProgress={shareMessageHistory.clearProgress}
        onConfirm={async () => {
          if (!shareHistoryTarget) {
            return false;
          }
          const shared =
            await shareMessageHistory.shareHistoryWithFriend(
              shareHistoryTarget,
            );
          if (shared) {
            friendships.markMessageHistorySharedLocally(
              shareHistoryTarget.keyId,
            );
          }
          return shared;
        }}
      />
    </>
  );
}
