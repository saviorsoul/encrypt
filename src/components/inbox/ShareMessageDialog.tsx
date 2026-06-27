import React, { useCallback } from 'react';
import Button from '@mui/material/Button';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';
import { useShareMessage } from '@/hooks/useShareMessage.ts';
import { useMessageRecipients } from '@/hooks/useMessageRecipients.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';
import type { StoredShare } from '@/services/db/storedShares.ts';

type ShareMessageDialogProps = {
  open: boolean;
  sourceMessage: StoredMessage | null;
  onClose: () => void;
  onShared?: (shareDelivery: StoredShare) => void;
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

  const {
    keysReady,
    keysLoading,
    error,
    busy,
    busyAction,
    handleShare,
    handleExportFile,
  } = useShareMessage({
    sourceMessage,
    recipients,
    recipientsLoading: loadingRecipientKeys,
    onShareCreated: (shareDelivery) => {
      onShared?.(shareDelivery);
      onClose();
    },
    onExported: onClose,
  });

  const handleShareLocally = useCallback(() => {
    void handleShare(recipients);
  }, [handleShare, recipients]);

  const handleExport = useCallback(() => {
    void handleExportFile(recipients);
  }, [handleExportFile, recipients]);

  const actionDisabled =
    !keysReady || busy || recipients.length === 0 || keysLoading;

  return (
    <AppDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Select recipients to receive a fresh key wrap for this message.
            Share locally saves a delivery in this browser. Export file
            downloads a JSON file (you will be prompted for your private key
            once to build the wraps, then the file downloads automatically).
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
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outlined"
          onClick={handleShareLocally}
          disabled={actionDisabled}
        >
          {busyAction === 'share' ? 'Sharing…' : 'Share locally'}
        </Button>
        <Button
          type="button"
          variant="contained"
          onClick={handleExport}
          disabled={actionDisabled}
          startIcon={<FileDownloadOutlinedIcon />}
        >
          {busyAction === 'export' ? 'Exporting…' : 'Export file'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
