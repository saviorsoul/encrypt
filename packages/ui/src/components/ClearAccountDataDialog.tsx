import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { AppDialog } from './AppDialog.tsx';

export type ClearAccountDataDialogProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onClearError: () => void;
};

export function ClearAccountDataDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
  onClearError,
}: ClearAccountDataDialogProps) {
  const handleClose = () => {
    if (busy) {
      return;
    }
    onClearError();
    onClose();
  };

  return (
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Clear account data</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
          This removes your account from this Feed API: friendships, friend
          requests, and encrypted copies that only you can decrypt. Your user
          record stays as inactive, so this key cannot be used to create a new
          account. Invitation records stay so the network can see who was
          invited in. Friends keep their own copies of messages. This cannot be
          undone. You will be signed out.
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
          data-testid="clear-account-data-confirm"
          variant="contained"
          color="error"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Clearing…' : 'Clear account data'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
