import React, { useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';

type ShareMessageDialogProps = {
  open: boolean;
  messageId: string | null;
  busy: boolean;
  error: string | null;
  recipientOptions: string[];
  selectedRecipients: string[];
  onSelectedRecipientsChange: (value: string[]) => void;
  getOptionLabel?: (option: string) => string;
  recipients: ManifestRecipientKeys[];
  loadingRecipients: boolean;
  recipientsError: string | null;
  onClose: () => void;
  onShare: (recipients: ManifestRecipientKeys[]) => Promise<string | null>;
  onClearError: () => void;
};

export function ShareMessageDialog({
  open,
  messageId,
  busy,
  error,
  recipientOptions,
  selectedRecipients,
  onSelectedRecipientsChange,
  getOptionLabel,
  recipients,
  loadingRecipients,
  recipientsError,
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
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Share message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Select recipients to receive a fresh key wrap for this message. You
            will be prompted for your private key when sharing.
          </Typography>

          {messageId ? (
            <Typography variant="caption" color="text.secondary">
              Thread: {messageId}
            </Typography>
          ) : null}

          {loadingRecipients ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading recipients…
              </Typography>
            </Box>
          ) : recipientOptions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No friends yet. Add or accept a friend request before sharing.
            </Typography>
          ) : (
            <RecipientMultiSelect
              options={recipientOptions}
              value={selectedRecipients}
              onChange={onSelectedRecipientsChange}
              getOptionLabel={getOptionLabel}
              disabled={busy}
            />
          )}

          {recipientsError ? (
            <Typography color="error" variant="body2">
              {recipientsError}
            </Typography>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
