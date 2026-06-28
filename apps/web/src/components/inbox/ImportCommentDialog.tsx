import React, { useCallback, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import { ImportJsonPayloadInput } from '@/components/shared/ImportJsonPayloadInput.tsx';
import { useImportComment } from '@/hooks/useImportComment.ts';
import type { StoredComment } from '@/services/db/storedComments.ts';

type ImportCommentDialogProps = {
  open: boolean;
  recipientKeyId: string | null;
  onClose: () => void;
  onImported?: (comment: StoredComment) => void;
};

export function ImportCommentDialog({
  open,
  recipientKeyId,
  onClose,
  onImported,
}: ImportCommentDialogProps) {
  const [payload, setPayload] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  const handleImported = useCallback(
    (comment: StoredComment) => {
      onImported?.(comment);
      onClose();
    },
    [onClose, onImported],
  );

  const {
    error: importError,
    busy,
    confirmImport,
    validateForImport,
    clearError,
    validatePayloadText,
  } = useImportComment({
    recipientKeyId,
    onImported: handleImported,
  });

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      clearError();
      setPayload('');
    }
  }

  const trimmedPayload = payload.trim();
  const payloadError = useMemo(() => {
    if (!trimmedPayload) {
      return null;
    }
    return validatePayloadText(trimmedPayload);
  }, [trimmedPayload, validatePayloadText]);

  const importValidationError = useMemo(() => {
    if (!trimmedPayload || payloadError) {
      return null;
    }
    return validateForImport(trimmedPayload);
  }, [trimmedPayload, payloadError, validateForImport]);

  const canImport =
    trimmedPayload.length > 0 &&
    payloadError === null &&
    importValidationError === null &&
    !busy;

  const handleImport = useCallback(async () => {
    await confirmImport(trimmedPayload);
  }, [confirmImport, trimmedPayload]);

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import comment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ImportJsonPayloadInput
            payload={payload}
            onPayloadChange={setPayload}
            disabled={busy}
            placeholder="Paste comment export JSON…"
            pasteHelperText="Paste a signed comment export JSON."
            getPayloadError={(trimmed) =>
              trimmed ? validatePayloadText(trimmed) : null
            }
          />
          {payloadError && <Alert severity="error">{payloadError}</Alert>}
          {importValidationError && (
            <Alert severity="error">{importValidationError}</Alert>
          )}
          {importError && <Alert severity="error">{importError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleImport()}
          disabled={!canImport}
        >
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
