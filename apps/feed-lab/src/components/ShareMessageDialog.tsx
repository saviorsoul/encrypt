import React, { useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import { AppDialog, MessagePolicyOptions } from '@encrypt/ui';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';

type ShareMessageDialogProps = {
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
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Share this message with your network.
          </Typography>

          {loadingRecipients ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading recipients…
              </Typography>
            </Box>
          ) : !hasFriends ? (
            <Typography variant="body2" color="text.secondary">
              No friends yet. You need to have at least one friend to be able to
              share.
            </Typography>
          ) : (
            <MessagePolicyOptions mode="share" />
          )}

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
