import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ImportJsonPayloadInput } from '@/components/shared/ImportJsonPayloadInput.tsx';
import { parseManifestPayloadText } from '@/utils/parseManifestPayloadText.ts';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';
import { validateManifestJsonText } from '@/utils/readImportJsonFile.ts';

type DecryptMessageDialogProps = {
  open: boolean;
  decrypting: boolean;
  decryptDisabled?: boolean;
  error: string | null;
  initialPayload?: string | null;
  initialFileName?: string | null;
  onClose: () => void;
  onDecrypt: (encryptedPayload: string) => void;
  onPayloadChange?: () => void;
};

export function DecryptMessageDialog({
  open,
  decrypting,
  decryptDisabled = false,
  error,
  initialPayload = null,
  initialFileName = null,
  onClose,
  onDecrypt,
  onPayloadChange,
}: DecryptMessageDialogProps) {
  const [payload, setPayload] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && !initialPayload) {
      setPayload('');
    }
  }

  const readOnly = Boolean(initialPayload);
  const displayPayload = useMemo(() => {
    if (initialPayload) {
      return prettifyJsonText(initialPayload);
    }
    return payload;
  }, [initialPayload, payload]);

  const trimmedPayload = displayPayload.trim();
  const parsed = useMemo(() => {
    if (!trimmedPayload) {
      return null;
    }
    return parseManifestPayloadText(trimmedPayload);
  }, [trimmedPayload]);
  const payloadError = parsed?.ok === false ? parsed.error : null;
  const canDecrypt = parsed?.ok === true && !decrypting && !decryptDisabled;
  const pasteHelperText =
    payloadError ??
    'You will be prompted to upload a private key that matches the sender or recipient public key.';

  return (
    <AppDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Import message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {!readOnly ? (
            <Typography variant="body2" color="text.secondary">
              Add an encrypted one-to-one message from a manifest JSON file or
              by pasting the signed payload. You will be prompted to upload a
              private key that matches the sender or recipient public key.
            </Typography>
          ) : null}

          <ImportJsonPayloadInput
            payload={displayPayload}
            onPayloadChange={setPayload}
            disabled={decrypting}
            readOnly={readOnly}
            readOnlyFileName={initialFileName}
            placeholder="Paste signed manifest JSON to decrypt…"
            pasteHelperText={pasteHelperText}
            getPayloadError={(text) => {
              if (!text) {
                return null;
              }
              const result = parseManifestPayloadText(text);
              return result.ok === false ? result.error : null;
            }}
            validateFileContent={validateManifestJsonText}
            onClearErrors={onPayloadChange}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
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
          Decrypt message
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
