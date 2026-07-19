import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type AddFriendTab = 'link' | 'publicKey';

type AddFriendDialogProps = {
  open: boolean;
  authenticated: boolean;
  hasFriends: boolean;
  invitationBusy: boolean;
  invitationError: string | null;
  invitationHref: string | null;
  requestBusy: boolean;
  requestError: string | null;
  requestInfo: string | null;
  onClose: () => void;
  onClearInvitationError: () => void;
  onClearRequestError: () => void;
  onCreateInvitation: (name: string) => void;
  onSendRequestByPublicKey: (
    publicKey: string,
    name: string,
  ) => Promise<{ ok: boolean }>;
};

export function AddFriendDialog({
  open,
  authenticated,
  hasFriends,
  invitationBusy,
  invitationError,
  invitationHref,
  requestBusy,
  requestError,
  requestInfo,
  onClose,
  onClearInvitationError,
  onClearRequestError,
  onCreateInvitation,
  onSendRequestByPublicKey,
}: AddFriendDialogProps) {
  const [tab, setTab] = useState<AddFriendTab>('link');
  const [invitationName, setInvitationName] = useState('');
  const [invitationNameError, setInvitationNameError] = useState<string | null>(
    null,
  );
  const [friendName, setFriendName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTab('link');
      setInvitationName('');
      setInvitationNameError(null);
      setFriendName('');
      setPublicKey('');
      setCopyState('idle');
    }
  }

  const busy = invitationBusy || requestBusy;
  const canInvite = authenticated && hasFriends;

  const handleCopyLink = useCallback(async () => {
    if (!invitationHref) {
      return;
    }
    try {
      await navigator.clipboard.writeText(invitationHref);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [invitationHref]);

  const handleCreateLink = useCallback(() => {
    const trimmed = invitationName.trim();
    if (!trimmed) {
      setInvitationNameError('Enter a name for this person.');
      return;
    }
    setInvitationNameError(null);
    onClearInvitationError();
    onCreateInvitation(trimmed);
  }, [invitationName, onClearInvitationError, onCreateInvitation]);

  const handleSendRequest = useCallback(() => {
    void onSendRequestByPublicKey(publicKey.trim(), friendName.trim()).then(
      (result) => {
        if (result.ok) {
          setFriendName('');
          setPublicKey('');
        }
      },
    );
  }, [friendName, onSendRequestByPublicKey, publicKey]);

  const copyLabel =
    copyState === 'ok'
      ? 'Copied'
      : copyState === 'err'
        ? 'Copy failed'
        : 'Copy invitation link';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add friend</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {!hasFriends ? (
            <Alert severity="info">
              Add or accept a friend before sending invitations. You can still
              accept an invitation link from someone else to get your first
              friend.
            </Alert>
          ) : null}

          <Tabs
            value={tab}
            onChange={(_, next: AddFriendTab) => setTab(next)}
            variant="fullWidth"
          >
            <Tab label="Invitation link" value="link" disabled={!canInvite} />
            <Tab label="Public key" value="publicKey" disabled={!canInvite} />
          </Tabs>

          {tab === 'link' ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                The person who gets the link sees your public key. The name you
                choose is stored only in this browser and matched to the
                invitation after they accept.
              </Typography>
              {invitationHref ? (
                <>
                  <TextField
                    label="Invitation link"
                    value={invitationHref}
                    fullWidth
                    multiline
                    minRows={2}
                    slotProps={{
                      input: {
                        readOnly: true,
                        sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
                      },
                    }}
                  />
                  <Alert severity="info">
                    Share this link with one person. It stops working after they
                    accept.
                  </Alert>
                </>
              ) : (
                <TextField
                  label="Username"
                  value={invitationName}
                  onChange={(e) => {
                    setInvitationName(e.target.value);
                    setInvitationNameError(null);
                    onClearInvitationError();
                  }}
                  fullWidth
                  disabled={busy || !canInvite}
                  error={invitationNameError != null}
                />
              )}
              {invitationError ? (
                <Alert severity="error">{invitationError}</Alert>
              ) : null}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Enter a local name and your friend&apos;s public key. An
                invitation is created on the backend and a friend request is
                sent.
              </Typography>
              <Alert severity="info">
                This public key must already be registered in the system. Ask
                your friend to join via an invitation link first if they have
                not signed up yet.
              </Alert>
              <TextField
                fullWidth
                label="Name"
                placeholder="Friend name"
                value={friendName}
                disabled={busy || !canInvite}
                onChange={(event) => {
                  setFriendName(event.target.value);
                  onClearRequestError();
                }}
              />
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Public key"
                placeholder='x;y or {"kty":"EC","crv":"P-256","x":"…","y":"…"}'
                value={publicKey}
                disabled={busy || !canInvite}
                onChange={(event) => {
                  setPublicKey(event.target.value);
                  onClearRequestError();
                }}
              />
              {requestError ? (
                <Alert severity="error">{requestError}</Alert>
              ) : null}
              {requestInfo ? (
                <Alert severity="info">{requestInfo}</Alert>
              ) : null}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={busy}>
          {invitationHref && tab === 'link' ? 'Close' : 'Cancel'}
        </Button>
        <Box>
          {tab === 'link' ? (
            invitationHref ? (
              <Button
                variant="contained"
                onClick={() => void handleCopyLink()}
                color={copyState === 'ok' ? 'success' : 'primary'}
              >
                {copyLabel}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreateLink}
                disabled={busy || !canInvite}
              >
                {invitationBusy ? 'Creating…' : 'Create link'}
              </Button>
            )
          ) : (
            <Button
              variant="contained"
              disabled={
                busy || !canInvite || !publicKey.trim() || !friendName.trim()
              }
              onClick={handleSendRequest}
            >
              {requestBusy ? 'Sending…' : 'Send request'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
