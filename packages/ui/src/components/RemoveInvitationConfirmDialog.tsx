import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { AppDialog } from './AppDialog.tsx';

export type RemoveInvitationConfirmDialogProps = {
  open: boolean;
  invitationLabel: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onClearError: () => void;
};

export function RemoveInvitationConfirmDialog({
  open,
  invitationLabel,
  busy,
  error,
  onClose,
  onConfirm,
  onClearError,
}: RemoveInvitationConfirmDialogProps) {
  const handleClose = () => {
    if (busy) {
      return;
    }
    onClearError();
    onClose();
  };

  return (
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Remove invitation?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {invitationLabel
            ? `Remove the invitation for ${invitationLabel}. The code will stop working immediately.`
            : 'Remove this invitation. The code will stop working immediately.'}
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Removing…' : 'Remove invitation'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
