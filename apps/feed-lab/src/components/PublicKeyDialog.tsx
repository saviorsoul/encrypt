import React, { useMemo, useState } from 'react';
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import {
  formatEcPublicKeyText,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/ecPublicKey';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';

type PublicKeyDialogProps = {
  open: boolean;
  publicKey: { x: string; y: string } | null;
  title?: string;
  onClose: () => void;
};

function formatPublicKeyText(
  publicKey: { x: string; y: string },
  format: 'xy' | 'json',
): string {
  const jwk = slimEcPublicJwk({
    kty: 'EC',
    crv: 'P-256',
    x: publicKey.x,
    y: publicKey.y,
  });
  if (format === 'json') {
    return prettifyJsonText(JSON.stringify(jwk));
  }
  return formatEcPublicKeyText(jwk);
}

export function PublicKeyDialog({
  open,
  publicKey,
  title = 'Public key',
  onClose,
}: PublicKeyDialogProps) {
  const [format, setFormat] = useState<'xy' | 'json'>('xy');
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const publicKeyText = useMemo(() => {
    if (!publicKey) {
      return '';
    }
    return formatPublicKeyText(publicKey, format);
  }, [format, publicKey]);

  return (
    <>
      <AppDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ToggleButtonGroup
              value={format}
              exclusive
              onChange={(_, next: 'xy' | 'json' | null) => {
                if (next) {
                  setFormat(next);
                }
              }}
              size="small"
            >
              <ToggleButton value="xy">x;y</ToggleButton>
              <ToggleButton value="json">JSON</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              label="Public key"
              value={publicKeyText}
              fullWidth
              multiline
              minRows={format === 'json' ? 6 : 2}
              onClick={() => {
                if (publicKeyText) {
                  void copyAndNotify(publicKeyText);
                }
              }}
              slotProps={{
                input: {
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    cursor: publicKeyText ? 'pointer' : 'default',
                  },
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="contained"
            disabled={!publicKeyText}
            onClick={() => void copyAndNotify(publicKeyText)}
          >
            Copy
          </Button>
        </DialogActions>
      </AppDialog>
      <CopiedToClipboardSnackbar {...snackbarProps} />
    </>
  );
}
