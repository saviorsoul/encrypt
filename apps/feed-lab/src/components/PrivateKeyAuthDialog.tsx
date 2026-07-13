import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type PrivateKeyAuthDialogProps = {
  open: boolean;
  sessionError: string | null;
  onAuthenticate: () => Promise<string | null>;
  onClearError: () => void;
};

export function PrivateKeyAuthDialog({
  open,
  sessionError,
  onAuthenticate,
  onClearError,
}: PrivateKeyAuthDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleChooseFile = useCallback(async () => {
    onClearError();
    setBusy(true);
    try {
      await onAuthenticate();
    } finally {
      setBusy(false);
    }
  }, [onAuthenticate, onClearError]);

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Sign in with private key</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            To use Feed Lab, select the private key file for the account you
            want to sign in with.
          </Typography>
          <Typography variant="body2">
            Click the button below to open your file picker and choose a{' '}
            <strong>.jwk</strong> or <strong>.json</strong> private key file.
          </Typography>
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}
          <Button
            variant="contained"
            size="large"
            fullWidth
            autoFocus
            disabled={busy}
            onClick={() => void handleChooseFile()}
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {busy ? 'Opening file picker…' : 'Choose private key file'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
