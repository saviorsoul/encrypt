import React, { useCallback } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { PendingExternalImport } from '@/components/providers/ExternalFileProvider.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { usePrivateKeyOnboardingGuard } from '@/hooks/usePrivateKeyOnboardingGuard.ts';

type ExternalImportMessageDialogProps = {
  fileName: string;
  messageText: string;
  onClose: () => void;
  onImportRequested: (payload: PendingExternalImport) => void;
};

export function ExternalImportMessageDialog({
  fileName,
  messageText,
  onClose,
  onImportRequested,
}: ExternalImportMessageDialogProps) {
  const { user } = useAuth();
  const onboardingStatus = usePrivateKeyOnboardingGuard();

  const canImportMessage =
    user !== null &&
    onboardingStatus !== 'loading' &&
    onboardingStatus !== 'required';

  const importDisabledReason = !user
    ? 'Sign in first to import a message into your feed.'
    : onboardingStatus === 'loading'
      ? 'Checking account status…'
      : onboardingStatus === 'required'
        ? 'Finish saving your private key before importing messages.'
        : null;

  const handleImport = useCallback(() => {
    onImportRequested({
      text: messageText,
      fileName,
    });
  }, [fileName, messageText, onImportRequested]);

  return (
    <AppDialog open fullWidth maxWidth="xs">
      <DialogTitle>Import encrypted message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Import{' '}
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 600 }}
            >
              {fileName}
            </Typography>{' '}
            into your feed. Your public key must be listed as a recipient.
          </Typography>
          {importDisabledReason ? (
            <Alert severity="info">{importDisabledReason}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canImportMessage}
          onClick={handleImport}
        >
          Import message
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
