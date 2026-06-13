import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { parseManifestPayloadText } from '@/utils/parseManifestPayloadText.ts';

type DecryptMessageDialogProps = {
  open: boolean;
  decrypting: boolean;
  decryptDisabled?: boolean;
  error: string | null;
  onClose: () => void;
  onDecrypt: (encryptedPayload: string) => void;
  onPayloadChange?: () => void;
};

export function DecryptMessageDialog({
  open,
  decrypting,
  decryptDisabled = false,
  error,
  onClose,
  onDecrypt,
  onPayloadChange,
}: DecryptMessageDialogProps) {
  const [payload, setPayload] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPayload('');
    }
  }

  const trimmedPayload = payload.trim();
  const parsed = useMemo(() => {
    if (!trimmedPayload) {
      return null;
    }
    return parseManifestPayloadText(trimmedPayload);
  }, [trimmedPayload]);
  const payloadError = parsed?.ok === false ? parsed.error : null;
  const canDecrypt = parsed?.ok === true && !decrypting && !decryptDisabled;
  const helperText =
    payloadError ??
    'You will be prompted to upload a private key that matches the sender or recipient public key.';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Import message</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Encrypted JSON"
          value={payload}
          onChange={(e) => {
            setPayload(e.target.value);
            onPayloadChange?.();
          }}
          fullWidth
          margin="dense"
          multiline
          rows={14}
          disabled={decrypting}
          placeholder="Paste signed manifest JSON to decrypt…"
          error={Boolean(payloadError)}
          helperText={helperText}
          slotProps={{
            input: {
              sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
            },
          }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={decrypting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canDecrypt}
          onClick={() => onDecrypt(trimmedPayload)}
        >
          Decrypt
        </Button>
      </DialogActions>
    </Dialog>
  );
}
