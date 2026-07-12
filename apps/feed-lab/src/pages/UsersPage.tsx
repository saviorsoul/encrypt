import React, { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabFriendshipRequests } from '@lab/hooks/useFeedLabFriendshipRequests.ts';
import { useBackendFriendshipRequests } from '@lab/hooks/useBackendFriendshipRequests.ts';
import {
  AcceptFriendRequestDialog,
  type PendingFriendRequest,
} from '@lab/components/AcceptFriendRequestDialog.tsx';
import { AddFriendDialog } from '@lab/components/AddFriendDialog.tsx';
import { useBackendFriendInvitations } from '@lab/hooks/useBackendFriendInvitations.ts';
import {
  saveFeedLabUser,
  loadFeedLabUserByKeyId,
} from '@lab/services/db/storedUsers.ts';
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
  const [addFriendDialogOpen, setAddFriendDialogOpen] = useState(false);

  const friendships = useFeedLabFriendships(
    keys.keyId,
    usernameByKeyId,
    addLocalUser,
  );
  const friendshipRequestList = useFeedLabFriendshipRequests(keys.keyId);

  const refreshFriendData = useCallback(async () => {
    await Promise.all([friendships.refresh(), friendshipRequestList.refresh()]);
  }, [friendships, friendshipRequestList]);

  const friendInvitations = useBackendFriendInvitations(refreshFriendData);

  const friendshipRequests = useBackendFriendshipRequests(
    refreshFriendData,
    (user) => {
      addLocalUser(user);
    },
  );

  const handleAcceptFriendWithName = useCallback(
    async (username: string) => {
      if (!acceptFriendRequest || !keys.keyId) {
        return;
      }

      setAcceptFriendError(null);
      const { requesterKeyId } = acceptFriendRequest;

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
      }
    },
    [acceptFriendRequest, addLocalUser, api, friendshipRequests, keys.keyId],
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

  return (
    <>
      {friendshipRequestList.incomingRequests.length > 0 ? (
        <Alert severity="info">
          {friendshipRequestList.incomingRequests.length === 1
            ? 'You have 1 incoming friend request.'
            : `You have ${friendshipRequestList.incomingRequests.length} incoming friend requests.`}
        </Alert>
      ) : null}

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
                  const entry = formatFriendListEntry(
                    request.requesterKeyId,
                    usernameByKeyId,
                  );
                  return (
                    <Stack
                      key={`${request.requesterKeyId}-${request.targetKeyId}`}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Box sx={{ flex: 1 }}>
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
                  disabled={!keys.keyId || friendInvitations.busy}
                  onClick={openAddFriendDialog}
                >
                  Add friend
                </Button>
              </Stack>
              {friendships.friends.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No friends yet.
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
                        <Typography variant="body2">{friend.label}</Typography>
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

        {friendships.error || friendshipRequestList.error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {friendships.error ?? friendshipRequestList.error}
          </Alert>
        ) : null}
      </Paper>

      <AddFriendDialog
        open={addFriendDialogOpen}
        authenticated={keys.keyId != null}
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
        busy={friendshipRequests.busy}
        error={acceptFriendError}
        onClose={() => {
          if (!friendshipRequests.busy) {
            setAcceptFriendRequest(null);
            setAcceptFriendError(null);
          }
        }}
        onAccept={handleAcceptFriendWithName}
        onClearError={() => setAcceptFriendError(null)}
      />
    </>
  );
}
