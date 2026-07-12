import React from 'react';
import { Alert, Snackbar } from '@mui/material';

type MessageSentSnackbarProps = {
  messageId: string | null;
  onClose: () => void;
};

export function MessageSentSnackbar({
  messageId,
  onClose,
}: MessageSentSnackbarProps) {
  return (
    <>
      <Snackbar
        key={messageId ?? 'message-sent'}
        open={messageId !== null}
        autoHideDuration={5000}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={onClose}
          sx={{ width: '100%' }}
        >
          Message sent: {messageId}
        </Alert>
      </Snackbar>
    </>
  );
}
