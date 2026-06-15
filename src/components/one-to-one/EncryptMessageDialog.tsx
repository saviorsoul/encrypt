import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

type EncryptMessageDialogProps = {
  open: boolean;
  roleLabel: string;
  encrypting: boolean;
  error: string | null;
  onClose: () => void;
  onEncrypt: (message: string) => void;
  onMessageChange?: () => void;
};

export function EncryptMessageDialog({
  open,
  roleLabel,
  encrypting,
  error,
  onClose,
  onEncrypt,
  onMessageChange,
}: EncryptMessageDialogProps) {
  const [message, setMessage] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMessage('');
    }
  }

  const trimmedMessage = message.trim();
  const canEncrypt = trimmedMessage.length > 0 && !encrypting;

  return (
    <AppDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Encrypt message</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            onMessageChange?.();
          }}
          fullWidth
          margin="dense"
          multiline
          minRows={4}
          disabled={encrypting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey && canEncrypt) {
              onEncrypt(trimmedMessage);
            }
          }}
          helperText={`You will be prompted to upload a private key that matches ${roleLabel}'s public key.`}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={encrypting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canEncrypt}
          onClick={() => onEncrypt(trimmedMessage)}
        >
          Encrypt
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
