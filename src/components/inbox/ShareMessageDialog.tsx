import React, { useCallback } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';
import { useShareMessage } from '@/hooks/useShareMessage.ts';
import { useMessageRecipients } from '@/hooks/useMessageRecipients.ts';
import type { StoredMessage } from '@/crypto/storedMessages.ts';

type ShareMessageDialogProps = {
  open: boolean;
  sourceMessage: StoredMessage | null;
  onClose: () => void;
  onShared?: (shareDelivery: StoredMessage) => void;
};

export function ShareMessageDialog({
  open,
  sourceMessage,
  onClose,
  onShared,
}: ShareMessageDialogProps) {
  const {
    availableOptions,
    selectedOptions,
    setSelectedOptions,
    recipients,
    loadingUsers,
    loadingRecipientKeys,
    loadingMockRecipients,
    getOptionLabel,
    error: recipientsError,
  } = useMessageRecipients();

  const { keysReady, keysLoading, error, busy, handleShare } = useShareMessage({
    sourceMessage,
    recipients,
    recipientsLoading: loadingRecipientKeys,
    onShareCreated: (shareDelivery) => {
      onShared?.(shareDelivery);
      onClose();
    },
  });

  const handleSubmit = useCallback(() => {
    void handleShare(recipients);
  }, [handleShare, recipients]);

  const shareDisabled =
    !keysReady || busy || recipients.length === 0 || keysLoading;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Share with new recipients using a fresh ephemeral key. Existing
            recipients keep their original access; only selected users receive a
            new delivery.
          </Typography>

          <RecipientMultiSelect
            options={availableOptions}
            value={selectedOptions}
            onChange={setSelectedOptions}
            getOptionLabel={getOptionLabel}
            disabled={busy || loadingUsers || loadingRecipientKeys}
          />

          {(recipientsError || error) && (
            <Typography color="error" variant="body2">
              {error ?? recipientsError}
            </Typography>
          )}

          {loadingMockRecipients && (
            <Typography variant="caption" color="text.secondary">
              Loading mock recipients…
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={shareDisabled}
        >
          {busy ? 'Sharing…' : 'Share'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
