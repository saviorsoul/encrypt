import React, { useCallback, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { StepOutputTextField } from '@/components/manifest-steps/StepOutputTextField.tsx';
import type { CopyState } from '@/types/copyState.ts';

type PublicKeyDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  publicKeyJwkText: string;
  jwkError?: string | null;
};

export function PublicKeyDialog({
  open,
  onClose,
  title,
  publicKeyJwkText,
  jwkError = null,
}: PublicKeyDialogProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const copyButtonLabel =
    copyState === 'ok'
      ? 'Copied'
      : copyState === 'err'
        ? 'Copy failed'
        : 'Copy';

  const handleClose = useCallback(() => {
    onClose();
    setCopyState('idle');
  }, [onClose]);

  const handleCopyPublicKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicKeyJwkText);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [publicKeyJwkText]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <StepOutputTextField
          label="JSON public JWK with kty, crv, x, and y"
          value={publicKeyJwkText}
          slotProps={{
            input: { readOnly: true },
          }}
          multiline
          rows={6}
          fullWidth
          error={Boolean(jwkError)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Close</Button>
        <Button
          variant="contained"
          color={copyState === 'ok' ? 'success' : 'primary'}
          onClick={() => void handleCopyPublicKey()}
        >
          {copyButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
