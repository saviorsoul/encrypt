import { useCallback } from 'react';
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { AppDialog } from './AppDialog.tsx';
import { MessagePolicyOptionsReveal } from './MessagePolicyOptions.tsx';

export type ShareMessageDialogProps = {
  open: boolean;
  messageId: string | null;
  busy: boolean;
  error: string | null;
  recipients: ManifestRecipientKeys[];
  loadingRecipients: boolean;
  recipientsError: string | null;
  hasFriends: boolean;
  onClose: () => void;
  onShare: (recipients: ManifestRecipientKeys[]) => Promise<string | null>;
  onClearError: () => void;
};

export function ShareMessageDialog({
  open,
  messageId,
  busy,
  error,
  recipients,
  loadingRecipients,
  recipientsError,
  hasFriends,
  onClose,
  onShare,
  onClearError,
}: ShareMessageDialogProps) {
  const handleClose = useCallback(() => {
    if (busy) {
      return;
    }
    onClearError();
    onClose();
  }, [busy, onClearError, onClose]);

  const handleShare = useCallback(async () => {
    if (!messageId) {
      return;
    }
    if (recipients.length === 0) {
      return;
    }
    onClearError();
    const shareId = await onShare(recipients);
    if (shareId) {
      onClose();
    }
  }, [messageId, onClearError, onClose, onShare, recipients]);

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Share"
      closeDisabled={busy}
      dismissOnBackdrop
      fullWidth
      maxWidth="sm"
    >
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Share this message with your friends network.
          </Typography>

          <MessagePolicyOptionsReveal
            loading={loadingRecipients}
            hasFriends={hasFriends}
            noFriendsMessage="No friends yet. Add or accept a friend request before sharing."
            mode="share"
          />

          {recipientsError ? (
            <Typography color="error" variant="body2">
              {recipientsError}
            </Typography>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          disabled={
            busy || !messageId || recipients.length === 0 || loadingRecipients
          }
          onClick={() => void handleShare()}
        >
          {busy ? 'Sharing…' : 'Share'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
