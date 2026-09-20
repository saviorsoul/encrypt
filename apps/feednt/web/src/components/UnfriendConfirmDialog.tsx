import React from 'react';
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { AppDialog } from '@encrypt/ui/AppDialog';

type UnfriendConfirmDialogProps = {
  open: boolean;
  friendName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onClearError: () => void;
  onExited?: () => void;
};

export function UnfriendConfirmDialog({
  open,
  friendName,
  busy,
  error,
  onClose,
  onConfirm,
  onClearError,
  onExited,
}: UnfriendConfirmDialogProps) {
  const handleClose = () => {
    if (busy) {
      return;
    }
    onClearError();
    onClose();
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        transition: {
          onExited,
        },
      }}
    >
      <DialogTitle>Unfriend</DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ pt: 1, overflowWrap: 'anywhere' }}
        >
          Remove {friendName} from your friends? You will no longer see each
          other&apos;s future posts and shares.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Unfriending…' : 'Unfriend'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
