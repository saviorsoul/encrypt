import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

type CleanDataDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function CleanDataDialog({
  open,
  onClose,
  onConfirm,
}: CleanDataDialogProps) {
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (cleaning) return;
    onClose();
    setError(null);
  }, [cleaning, onClose]);

  const handleConfirm = useCallback(async () => {
    setCleaning(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Failed to clean local data. Please try again.');
      setCleaning(false);
    }
  }, [onConfirm]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Clean local data</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          This will permanently delete all local app data, including stored
          messages, keys, and session information. This cannot be undone.
        </DialogContentText>
        {error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={cleaning}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void handleConfirm()}
          disabled={cleaning}
        >
          Clean data
        </Button>
      </DialogActions>
    </Dialog>
  );
}
