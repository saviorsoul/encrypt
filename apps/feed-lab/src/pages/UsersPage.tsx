import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabFriendships } from '@lab/providers/FeedLabFriendshipsProvider.tsx';
import { useBackendFriendshipRequests } from '@lab/hooks/useBackendFriendshipRequests.ts';
import {
  AcceptFriendRequestDialog,
  type PendingFriendRequest,
} from '@lab/components/AcceptFriendRequestDialog.tsx';
import { AddFriendDialog } from '@lab/components/AddFriendDialog.tsx';
import { PublicKeyDialog } from '@lab/components/PublicKeyDialog.tsx';
import { UnfriendConfirmDialog } from '@lab/components/UnfriendConfirmDialog.tsx';
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { InvitationQrCodeDialog } from '@encrypt/ui/InvitationQrCodeDialog';
import { AcceptInvitationDialog } from '@encrypt/ui/AcceptInvitationDialog';
import { InvitationQrScanDialog } from '@encrypt/ui/InvitationQrScanDialog';
import { useBackendFriendInvitations } from '@lab/hooks/useBackendFriendInvitations.ts';
import { useCopiedToClipboardSnackbar } from '@encrypt/ui/useCopiedToClipboardSnackbar';
import {
  saveFeedLabUser,
  loadFeedLabUserByKeyId,
} from '@lab/services/db/storedUsers.ts';
import { FriendNameField } from '@lab/components/FriendNameField.tsx';
import { InvitationLabelField } from '@lab/components/InvitationLabelField.tsx';
import {
  formatCommentAuthorLabel,
  formatFriendListEntry,
} from '@lab/lib/formatCommentAuthorLabel.ts';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

export function UsersPage() {
  const navigate = useNavigate();
  const api = useFeedApi();
  const { keys, feedLabUsers } = useFeedLabSession();
  const { addLocalUser, usernameByKeyId, usernames } = feedLabUsers;

  const [acceptFriendRequest, setAcceptFriendRequest] =
    useState<PendingFriendRequest | null>(null);
  const [acceptFriendError, setAcceptFriendError] = useState<string | null>(
    null,
  );
  const [acceptFriendBusy, setAcceptFriendBusy] = useState(false);
  const [addFriendDialogOpen, setAddFriendDialogOpen] = useState(false);
  const [viewPublicKey, setViewPublicKey] = useState<{
    x: string;
    y: string;
  } | null>(null);
  const [qrCodeToken, setQrCodeToken] = useState<string | null>(null);
  const [acceptInvitationOpen, setAcceptInvitationOpen] = useState(false);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [unfriendDialogOpen, setUnfriendDialogOpen] = useState(false);
  const [unfriendTarget, setUnfriendTarget] = useState<{
    keyId: string;
    label: string;
  } | null>(null);
  const [unfriendError, setUnfriendError] = useState<string | null>(null);
  const unfriendSucceededRef = useRef(false);
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const friendships = useFeedLabFriendships();

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

  const handleAcceptFriendWithName = useCallback(
    async (username: string) => {
      if (!acceptFriendRequest || !keys.keyId || acceptFriendBusy) {
        return;
      }

      setAcceptFriendError(null);
      setAcceptFriendBusy(true);
      const { requesterKeyId } = acceptFriendRequest;

      try {
        const storedUser = await loadFeedLabUserByKeyId(
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
          await saveFeedLabUser(keys.keyId, username, publicJwk);
          addLocalUser({ keyId: requesterKeyId, username });
          setAcceptFriendRequest(null);
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
      friendshipRequests,
      keys.keyId,
      refreshFriendData,
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
    setUnfriendDialogOpen(false);
  }, [friendshipRequests, keys.keyId, unfriendTarget]);

  const openAddFriendDialog = useCallback(() => {
    friendInvitations.clearError();
    friendInvitations.clearLastInvitationId();
    friendshipRequests.clearError();
    friendshipRequests.clearInfo();
    setAddFriendDialogOpen(true);
  }, [friendInvitations, friendshipRequests]);

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
      setQrScanOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  const handleQrScanRequest = useCallback(() => {
    setAcceptInvitationOpen(false);
    setQrScanOpen(true);
  }, []);

  const handleInvitationIdSubmit = useCallback(
    (token: string) => {
      setAcceptInvitationOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

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

  return (
    <>
      <Paper sx={{ p: 2 }}>
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
              disabled={!keys.keyId || friendships.usersLoading}
              onClick={() => setAcceptInvitationOpen(true)}
            >
              Accept invite
            </Button>
            <Button
              data-testid="users-add-friend"
              variant="contained"
              size="small"
              disabled={
                !keys.keyId ||
                friendships.usersLoading ||
                friendInvitations.busy ||
                friendships.friends.length === 0
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
        ) : friendships.usersLoading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading friendships…</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {friendships.incomingRequests.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Incoming requests</Typography>
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
                                  setViewPublicKey(request.publicKey);
                                }
                              }}
                              sx={{ flexShrink: 0 }}
                            >
                              <KeyOutlinedIcon fontSize="inherit" />
                            </IconButton>
                          ) : null}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                        <Button
                          data-testid="users-accept-friend-request"
                          size="small"
                          variant="contained"
                          disabled={friendshipRequests.busy}
                          onClick={() => {
                            setAcceptFriendError(null);
                            friendshipRequests.clearError();
                            setAcceptFriendRequest({
                              requesterKeyId: request.requesterKeyId,
                              targetKeyId: request.targetKeyId,
                            });
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
              </Stack>
            ) : null}

            {friendships.outgoingRequests.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Outgoing requests</Typography>
                {friendships.outgoingRequests.map((request) => {
                  const entry = formatFriendListEntry(
                    request.targetKeyId,
                    usernameByKeyId,
                    friendships.invitationLabelByToken[request.invitationToken],
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
              </Stack>
            ) : null}

            {shareablePendingInvitations.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">
                  Pending invitations ({shareablePendingInvitations.length})
                </Typography>
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
                    <IconButton
                      size="small"
                      aria-label="Show invitation QR code"
                      onClick={() => setQrCodeToken(invitation.token)}
                      sx={{ flexShrink: 0 }}
                    >
                      <QrCode2OutlinedIcon fontSize="inherit" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Copy invitation ID"
                      onClick={() => void copyAndNotify(invitation.token)}
                      sx={{ flexShrink: 0 }}
                    >
                      <ContentCopyOutlinedIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : null}

            <Stack spacing={1}>
              <Typography variant="subtitle2">
                Your friends ({friendships.friends.length})
              </Typography>
              {friendships.friends.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No friends yet. Accept an invitation from someone else to get
                  started — you need at least one friend before you can invite
                  others.
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
                      <Button
                        size="small"
                        color="error"
                        disabled={friendshipRequests.busy || !keys.keyId}
                        sx={{ flexShrink: 0 }}
                        onClick={() => {
                          if (!keys.keyId) {
                            return;
                          }
                          setUnfriendError(null);
                          friendshipRequests.clearError();
                          setUnfriendTarget({
                            keyId: friend.keyId,
                            label:
                              usernameByKeyId[friend.keyId]?.trim() ||
                              friend.label,
                          });
                          setUnfriendDialogOpen(true);
                        }}
                      >
                        Unfriend
                      </Button>
                    </Stack>
                  );
                })
              )}
            </Stack>
          </Stack>
        )}

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
        hasFriends={friendships.friends.length > 0}
        invitationBusy={friendInvitations.busy}
        invitationError={friendInvitations.error}
        invitationId={friendInvitations.lastInvitationId}
        requestBusy={friendshipRequests.busy}
        requestError={friendshipRequests.error}
        requestInfo={friendshipRequests.info}
        onClose={() => setAddFriendDialogOpen(false)}
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
        busy={friendshipRequests.busy || acceptFriendBusy}
        error={acceptFriendError}
        onClose={() => {
          if (!friendshipRequests.busy && !acceptFriendBusy) {
            setAcceptFriendRequest(null);
            setAcceptFriendError(null);
          }
        }}
        onAccept={handleAcceptFriendWithName}
        onClearError={() => setAcceptFriendError(null)}
      />

      <UnfriendConfirmDialog
        open={unfriendDialogOpen}
        friendName={unfriendTarget?.label ?? ''}
        busy={friendshipRequests.busy}
        error={unfriendError}
        onClose={() => {
          if (!friendshipRequests.busy) {
            setUnfriendDialogOpen(false);
          }
        }}
        onExited={() => {
          const shouldRefresh = unfriendSucceededRef.current;
          unfriendSucceededRef.current = false;
          setUnfriendTarget(null);
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
        onClose={() => setViewPublicKey(null)}
      />

      <AcceptInvitationDialog
        open={acceptInvitationOpen}
        onClose={() => setAcceptInvitationOpen(false)}
        onSubmit={handleInvitationIdSubmit}
        qrScanAvailable
        onQrScanRequest={handleQrScanRequest}
      />
      <InvitationQrScanDialog
        open={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        onTokenScanned={handleQrTokenScanned}
      />

      {qrCodeToken ? (
        <InvitationQrCodeDialog
          open={qrCodeToken != null}
          token={qrCodeToken}
          onClose={() => setQrCodeToken(null)}
        />
      ) : null}
    </>
  );
}
