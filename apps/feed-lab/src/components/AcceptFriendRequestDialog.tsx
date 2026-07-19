import React, { useState } from 'react';
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AppDialog } from '@/components/shared/AppDialog.tsx';

export type PendingFriendRequest = {
  requesterKeyId: string;
  targetKeyId: string;
};

type AcceptFriendRequestDialogProps = {
  open: boolean;
  request: PendingFriendRequest | null;
  requesterLabel: string;
  suggestedUsername: string;
  existingUsernameForRequester: string;
  existingUsernames: string[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onAccept: (username: string) => Promise<void>;
  onClearError: () => void;
};

export function AcceptFriendRequestDialog({
  open,
  request,
  requesterLabel,
  suggestedUsername,
  existingUsernameForRequester,
  existingUsernames,
  busy,
  error,
  onClose,
  onAccept,
  onClearError,
}: AcceptFriendRequestDialogProps) {
  const [username, setUsername] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevSuggestedUsername, setPrevSuggestedUsername] =
    useState(suggestedUsername);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUsername(suggestedUsername);
    }
  }

  if (suggestedUsername !== prevSuggestedUsername) {
    setPrevSuggestedUsername(suggestedUsername);
    if (open && !username.trim()) {
      setUsername(suggestedUsername);
    }
  }

  const trimmedUsername = username.trim();
  const nameExists =
    trimmedUsername.length > 0 &&
    existingUsernames.some(
      (existing) =>
        existing.localeCompare(trimmedUsername, undefined, {
          sensitivity: 'accent',
        }) === 0,
    ) &&
    trimmedUsername.localeCompare(existingUsernameForRequester, undefined, {
      sensitivity: 'accent',
    }) !== 0;
  const duplicateError = nameExists
    ? `"${trimmedUsername}" already exists. Choose a unique name.`
    : null;
  const displayError = duplicateError ?? error;
  const canAccept =
    Boolean(request) && trimmedUsername.length > 0 && !busy && !nameExists;

  const handleClose = () => {
    if (busy) {
      return;
    }
    onClearError();
    onClose();
  };

  return (
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Accept friend request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Choose a local name for {requesterLabel}. Names are stored in this
            browser only.
          </Typography>
          <TextField
            autoFocus
            label="Name"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              onClearError();
            }}
            fullWidth
            disabled={busy}
            error={Boolean(displayError)}
            helperText={
              displayError ?? 'This name appears in your friends list.'
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canAccept) {
                event.preventDefault();
                void onAccept(trimmedUsername);
              }
            }}
          />
          {duplicateError ? (
            <Alert severity="error">{duplicateError}</Alert>
          ) : null}
          {!duplicateError && error ? (
            <Alert severity="error">{error}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canAccept}
          onClick={() => void onAccept(trimmedUsername)}
        >
          {busy ? 'Accepting…' : 'Accept'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
