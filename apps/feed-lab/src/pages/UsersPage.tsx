import React, { useCallback, useState } from 'react';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
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
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabFriendshipRequests } from '@lab/hooks/useFeedLabFriendshipRequests.ts';
import { useFeedLabPendingInvitations } from '@lab/hooks/useFeedLabPendingInvitations.ts';
import { useBackendFriendshipRequests } from '@lab/hooks/useBackendFriendshipRequests.ts';
import {
  AcceptFriendRequestDialog,
  type PendingFriendRequest,
} from '@lab/components/AcceptFriendRequestDialog.tsx';
import { AddFriendDialog } from '@lab/components/AddFriendDialog.tsx';
import { PublicKeyDialog } from '@lab/components/PublicKeyDialog.tsx';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useBackendFriendInvitations } from '@lab/hooks/useBackendFriendInvitations.ts';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';
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
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const friendships = useFeedLabFriendships(
    keys.keyId,
    usernameByKeyId,
    addLocalUser,
  );
  const friendshipRequestList = useFeedLabFriendshipRequests(keys.keyId);
  const pendingInvitations = useFeedLabPendingInvitations(keys.keyId);

  const refreshFriendData = useCallback(async () => {
    await Promise.all([
      friendships.refresh(),
      friendshipRequestList.refresh(),
      pendingInvitations.refresh(),
    ]);
  }, [friendships, friendshipRequestList, pendingInvitations]);

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

  const openAddFriendDialog = useCallback(() => {
    friendInvitations.clearError();
    friendInvitations.clearLastInvitationHref();
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

  const outgoingInvitationTokens = new Set(
    friendshipRequestList.outgoingRequests.map(
      (request) => request.invitationToken,
    ),
  );
  const shareablePendingInvitations = pendingInvitations.invitations.filter(
    (invitation) => !outgoingInvitationTokens.has(invitation.token),
  );
  const invitationLabels = shareablePendingInvitations
    .map((invitation) => invitation.label?.trim())
    .filter((label): label is string => Boolean(label));
  const existingLocalNames = [...usernames, ...invitationLabels];

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Friends
        </Typography>

        {!keys.keyId ? (
          <Typography variant="body2" color="text.secondary">
            Authenticate with your private key to manage friendships.
          </Typography>
        ) : friendships.loading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading friendships…</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {friendshipRequestList.incomingRequests.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Incoming requests</Typography>
                {friendshipRequestList.incomingRequests.map((request) => {
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

            {friendshipRequestList.outgoingRequests.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Outgoing requests</Typography>
                {friendshipRequestList.outgoingRequests.map((request) => {
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
                  Pending invitation links (
                  {shareablePendingInvitations.length})
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
                            pendingInvitations.updateLabel(
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
                      aria-label="Copy invitation link"
                      onClick={() => void copyAndNotify(invitation.href)}
                      sx={{ flexShrink: 0 }}
                    >
                      <ContentCopyOutlinedIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : null}

            <Stack spacing={1}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Typography variant="subtitle2">
                  Your friends ({friendships.friends.length})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={
                    !keys.keyId ||
                    friendInvitations.busy ||
                    friendships.friends.length === 0
                  }
                  onClick={openAddFriendDialog}
                >
                  Add friend
                </Button>
              </Stack>
              {friendships.friends.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No friends yet. Accept an invitation link from someone else to
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
                      sx={{ alignItems: 'center' }}
                    >
                      <Box sx={{ flex: 1 }}>
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
                          sx={{ display: 'block' }}
                        >
                          {friend.keyId}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        color="error"
                        disabled={friendshipRequests.busy || !keys.keyId}
                        onClick={() => {
                          if (!keys.keyId) {
                            return;
                          }
                          void friendshipRequests.unfriend(friend.keyId);
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

        {friendships.error ||
        friendshipRequestList.error ||
        pendingInvitations.error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {friendships.error ??
              friendshipRequestList.error ??
              pendingInvitations.error}
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
        invitationHref={friendInvitations.lastInvitationHref}
        requestBusy={friendshipRequests.busy}
        requestError={friendshipRequests.error}
        requestInfo={friendshipRequests.info}
        onClose={() => setAddFriendDialogOpen(false)}
        onClearInvitationError={friendInvitations.clearError}
        onClearRequestError={friendshipRequests.clearError}
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

      <PublicKeyDialog
        open={viewPublicKey != null}
        publicKey={viewPublicKey}
        title="Public key"
        onClose={() => setViewPublicKey(null)}
      />
    </>
  );
}
