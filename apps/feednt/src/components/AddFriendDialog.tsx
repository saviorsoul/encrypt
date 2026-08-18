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
import { InvitationQrCodeDialog } from '@encrypt/ui/InvitationQrCodeDialog';
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { useCopiedToClipboardSnackbar } from '@encrypt/ui/useCopiedToClipboardSnackbar';

type AddFriendTab = 'id' | 'publicKey';

type AddFriendDialogProps = {
  open: boolean;
  authenticated: boolean;
  hasFriends: boolean;
  invitationBusy: boolean;
  invitationError: string | null;
  invitationId: string | null;
  requestBusy: boolean;
  requestError: string | null;
  requestInfo: string | null;
  onClose: () => void;
  onClearInvitationError: () => void;
  onClearRequestError: () => void;
  onCancelInFlight: () => void;
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
  invitationId,
  requestBusy,
  requestError,
  requestInfo,
  onClose,
  onClearInvitationError,
  onClearRequestError,
  onCancelInFlight,
  onCreateInvitation,
  onSendRequestByPublicKey,
}: AddFriendDialogProps) {
  const [tab, setTab] = useState<AddFriendTab>('id');
  const [invitationName, setInvitationName] = useState('');
  const [invitationNameError, setInvitationNameError] = useState<string | null>(
    null,
  );
  const [friendName, setFriendName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTab('id');
      setInvitationName('');
      setInvitationNameError(null);
      setFriendName('');
      setPublicKey('');
      setQrDialogOpen(false);
    }
  }

  const busy = invitationBusy || requestBusy;
  const canInvite = authenticated && hasFriends;

  const handleCopyId = useCallback(() => {
    if (!invitationId) {
      return;
    }
    void copyAndNotify(invitationId);
  }, [copyAndNotify, invitationId]);

  const handleCreateInvitation = useCallback(() => {
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

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (busy) {
          onCancelInFlight();
        }
        onClose();
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Add friend</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {!hasFriends ? (
            <Alert severity="info">
              Add or accept a friend before sending invitations. You can still
              accept an invitation from someone else to get your first friend.
            </Alert>
          ) : null}

          <Tabs
            value={tab}
            onChange={(_, next: AddFriendTab) => setTab(next)}
            variant="fullWidth"
          >
            <Tab label="Invitation ID" value="id" disabled={!canInvite} />
            <Tab label="Public key" value="publicKey" disabled={!canInvite} />
          </Tabs>

          {tab === 'id' ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                The person who gets the invitation ID sees your public key. The
                name you choose is stored only in this browser and matched to
                the invitation after they accept.
              </Typography>
              {invitationId ? (
                <>
                  <TextField
                    label="Invitation ID"
                    value={invitationId}
                    fullWidth
                    multiline
                    minRows={2}
                    onClick={handleCopyId}
                    slotProps={{
                      input: {
                        readOnly: true,
                        sx: {
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        },
                      },
                    }}
                  />
                  <Alert severity="info">
                    Share this ID with one person. It stops working after they
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
                your friend to join via an invitation first if they have not
                signed up yet.
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
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button
          onClick={() => {
            if (busy) {
              onCancelInFlight();
            }
            onClose();
          }}
        >
          {invitationId && tab === 'id' ? 'Close' : 'Cancel'}
        </Button>
        <Box>
          {tab === 'id' ? (
            invitationId ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => setQrDialogOpen(true)}
                >
                  Show QR code
                </Button>
                <Button variant="contained" onClick={handleCopyId}>
                  Copy invitation ID
                </Button>
              </Stack>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreateInvitation}
                disabled={busy || !canInvite}
              >
                {invitationBusy ? 'Creating…' : 'Create invitation'}
              </Button>
            )
          ) : (
            <Button
              variant="contained"
              disabled={
                busy ||
                !canInvite ||
                !publicKey.trim() ||
                !friendName.trim() ||
                Boolean(requestError)
              }
              onClick={handleSendRequest}
            >
              {requestBusy ? 'Sending…' : 'Send request'}
            </Button>
          )}
        </Box>
      </DialogActions>
      {invitationId ? (
        <InvitationQrCodeDialog
          open={qrDialogOpen}
          token={invitationId}
          onClose={() => setQrDialogOpen(false)}
        />
      ) : null}
      <CopiedToClipboardSnackbar {...snackbarProps} />
    </Dialog>
  );
}
