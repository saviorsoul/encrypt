import React, { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { GenerateRecipientDialog } from '@/components/one-to-one/GenerateRecipientDialog.tsx';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useBackendAddUser } from '@lab/hooks/useBackendAddUser.ts';
import { useBackendGenerateUser } from '@lab/hooks/useBackendGenerateUser.ts';
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useBackendFriendshipRequests } from '@lab/hooks/useBackendFriendshipRequests.ts';
import {
  AcceptFriendRequestDialog,
  type PendingFriendRequest,
} from '@lab/components/AcceptFriendRequestDialog.tsx';
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

  const [addUserName, setAddUserName] = useState('');
  const [addUserPublicKey, setAddUserPublicKey] = useState('');
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [friendRequestPublicKey, setFriendRequestPublicKey] = useState('');
  const [friendRequestName, setFriendRequestName] = useState('');
  const [acceptFriendRequest, setAcceptFriendRequest] =
    useState<PendingFriendRequest | null>(null);
  const [acceptFriendError, setAcceptFriendError] = useState<string | null>(
    null,
  );

  const friendships = useFeedLabFriendships(keys.keyId, usernameByKeyId);
  const friendshipRequests = useBackendFriendshipRequests(
    () => friendships.refresh(),
    (user) => {
      addLocalUser(user);
    },
  );

  const handleUserRegistered = useCallback(
    (input: {
      keyId: string;
      username: string;
      publicKey: { x: string; y: string };
    }) => {
      addLocalUser({
        keyId: input.keyId,
        username: input.username,
      });
    },
    [addLocalUser],
  );

  const addUser = useBackendAddUser(handleUserRegistered);
  const generateUser = useBackendGenerateUser(handleUserRegistered);
  const registerBusy = addUser.busy || generateUser.busy;

  const handleAcceptFriendWithName = useCallback(
    async (username: string) => {
      if (!acceptFriendRequest) {
        return;
      }

      setAcceptFriendError(null);
      const { requesterKeyId, targetKeyId } = acceptFriendRequest;

      const storedUser = await loadFeedLabUserByKeyId(requesterKeyId);
      const acceptError = await friendshipRequests.acceptRequest(
        requesterKeyId,
        targetKeyId,
      );
      if (acceptError) {
        setAcceptFriendError(acceptError);
        return;
      }

      let publicJwk: JsonWebKey;
      if (storedUser) {
        publicJwk = storedUser.publicJwk;
      } else {
        const friendshipsList = await api.getFriendships(targetKeyId);
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
        await saveFeedLabUser(username, publicJwk);
        addLocalUser({ keyId: requesterKeyId, username });
        setAcceptFriendRequest(null);
      } catch (e) {
        setAcceptFriendError(
          e instanceof Error ? e.message : 'Failed to accept friend request.',
        );
      }
    },
    [acceptFriendRequest, addLocalUser, api, friendshipRequests],
  );

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Register user
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Register a recipient with a local name and public key, or generate a
          new key pair. Names are stored in this browser only; the backend
          stores keyId and publicKey.
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Name"
            placeholder="Recipient name"
            value={addUserName}
            disabled={registerBusy}
            onChange={(event) => {
              setAddUserName(event.target.value);
              addUser.clearError();
              addUser.clearInfo();
              addUser.clearLastKeyId();
              generateUser.clearInfo();
              generateUser.clearLastKeyId();
            }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Public key"
            placeholder='x;y or {"x":"…","y":"…"}'
            value={addUserPublicKey}
            disabled={registerBusy}
            onChange={(event) => {
              setAddUserPublicKey(event.target.value);
              addUser.clearError();
              addUser.clearInfo();
              addUser.clearLastKeyId();
              generateUser.clearInfo();
              generateUser.clearLastKeyId();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void addUser.addUser(
                  addUserName.trim(),
                  addUserPublicKey.trim(),
                );
              }
            }}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            disabled={registerBusy}
            onClick={() => {
              generateUser.clearError();
              generateUser.clearInfo();
              generateUser.clearLastKeyId();
              addUser.clearInfo();
              addUser.clearLastKeyId();
              setGenerateDialogOpen(true);
            }}
          >
            Generate user
          </Button>
          <Button
            variant="contained"
            disabled={
              registerBusy || !addUserName.trim() || !addUserPublicKey.trim()
            }
            onClick={() =>
              void addUser.addUser(addUserName.trim(), addUserPublicKey.trim())
            }
          >
            {addUser.busy ? 'Registering…' : 'Add user'}
          </Button>
        </Stack>
        {generateUser.info ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {generateUser.info}
          </Alert>
        ) : null}
        {addUser.info ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {addUser.info}
          </Alert>
        ) : null}
        {addUser.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {addUser.error}
          </Alert>
        ) : null}
        {generateUser.lastKeyId && generateUser.lastUsername ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {generateUser.lastUsername} generated, private key downloaded,
            registered with keyId: {generateUser.lastKeyId}
          </Alert>
        ) : null}
        {addUser.lastKeyId ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {addUserName.trim()} registered with keyId: {addUser.lastKeyId}
          </Alert>
        ) : null}
      </Paper>

      <GenerateRecipientDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        existingUsernames={usernames}
        generating={generateUser.busy}
        error={generateUser.error}
        onNameChange={generateUser.clearError}
        onGenerate={(username) =>
          void generateUser.generateUser(username).then((keyId) => {
            if (keyId) {
              setGenerateDialogOpen(false);
            }
          })
        }
      />

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Friends
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mutual friendships are required before you can message someone. Set
          your keyId above, then send or accept friend requests.
        </Typography>

        {!keys.keyId ? (
          <Typography variant="body2" color="text.secondary">
            Set your keyId to manage friendships.
          </Typography>
        ) : friendships.loading ? (
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
                            request.targetKeyId,
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

            <Stack spacing={1}>
              <Typography variant="subtitle2">Add friend</Typography>
              <Typography variant="body2" color="text.secondary">
                Enter a local name and the friend&apos;s public key. If they are
                not registered on the backend yet, they will be registered
                automatically before the request is sent.
              </Typography>
              <TextField
                fullWidth
                label="Name"
                placeholder="Friend name"
                value={friendRequestName}
                disabled={friendshipRequests.busy}
                onChange={(event) => {
                  setFriendRequestName(event.target.value);
                  friendshipRequests.clearError();
                }}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Public key"
                placeholder='x;y or {"x":"…","y":"…"}'
                value={friendRequestPublicKey}
                disabled={friendshipRequests.busy}
                onChange={(event) => {
                  setFriendRequestPublicKey(event.target.value);
                  friendshipRequests.clearError();
                }}
              />
              <Box>
                <Button
                  variant="contained"
                  disabled={
                    friendshipRequests.busy ||
                    !friendRequestPublicKey.trim() ||
                    !friendRequestName.trim() ||
                    !keys.keyId
                  }
                  onClick={() => {
                    if (
                      !keys.keyId ||
                      !friendRequestPublicKey.trim() ||
                      !friendRequestName.trim()
                    ) {
                      return;
                    }
                    void friendshipRequests
                      .sendRequestByPublicKey(
                        keys.keyId,
                        friendRequestPublicKey.trim(),
                        friendRequestName.trim(),
                        usernames,
                        usernameByKeyId,
                      )
                      .then((keyId) => {
                        if (keyId) {
                          setFriendRequestPublicKey('');
                          setFriendRequestName('');
                        }
                      });
                  }}
                >
                  {friendshipRequests.busy ? 'Sending…' : 'Send request'}
                </Button>
              </Box>
            </Stack>

            {friendships.outgoingRequests.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Outgoing requests</Typography>
                {friendships.outgoingRequests.map((request) => {
                  const entry = formatFriendListEntry(
                    request.targetKeyId,
                    usernameByKeyId,
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
              <Typography variant="subtitle2">
                Your friends ({friendships.friends.length})
              </Typography>
              {friendships.friends.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No friends yet. Send or accept a request to start messaging.
                </Typography>
              ) : (
                friendships.friends.map((friend) => {
                  const entry = formatFriendListEntry(
                    friend.keyId,
                    usernameByKeyId,
                  );
                  return (
                    <Stack
                      key={friend.keyId}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center' }}
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
                        color="error"
                        disabled={friendshipRequests.busy || !keys.keyId}
                        onClick={() => {
                          if (!keys.keyId) {
                            return;
                          }
                          void friendshipRequests.unfriend(
                            keys.keyId,
                            friend.keyId,
                          );
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

        {friendships.error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {friendships.error}
          </Alert>
        ) : null}
        {friendshipRequests.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {friendshipRequests.error}
          </Alert>
        ) : null}
      </Paper>

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
