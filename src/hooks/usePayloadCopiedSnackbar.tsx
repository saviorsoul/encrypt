import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';

const PAYLOAD_COPIED_SNACKBAR_MS = 5000;
const PAYLOAD_COPIED_MESSAGE = 'Message copied to clipboard';
const PAYLOAD_COPY_FAILED_MESSAGE = 'Failed to copy message to clipboard';

type PayloadCopiedSnackbarState = {
  open: boolean;
  key: number;
  severity: 'success' | 'error';
};

export function usePayloadCopiedSnackbar() {
  const [snackbar, setSnackbar] = useState<PayloadCopiedSnackbarState>({
    open: false,
    key: 0,
    severity: 'success',
  });

  const copyPayloadAndNotify = useCallback(async (payload: string) => {
    try {
      await copyTextToClipboard(payload);
      setSnackbar((prev) => ({
        open: true,
        key: prev.key + 1,
        severity: 'success',
      }));
    } catch {
      setSnackbar((prev) => ({
        open: true,
        key: prev.key + 1,
        severity: 'error',
      }));
    }
  }, []);

  const payloadCopiedSnackbar = (
    <Snackbar
      key={`payload-copied-${snackbar.key}`}
      open={snackbar.open}
      autoHideDuration={PAYLOAD_COPIED_SNACKBAR_MS}
      onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity={snackbar.severity}
        variant="filled"
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        sx={{ width: '100%' }}
      >
        {snackbar.severity === 'success'
          ? PAYLOAD_COPIED_MESSAGE
          : PAYLOAD_COPY_FAILED_MESSAGE}
      </Alert>
    </Snackbar>
  );

  return { copyPayloadAndNotify, payloadCopiedSnackbar };
}
