import React, { useCallback, useMemo, useState } from 'react';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { StepOutputTextField } from '@/components/manifest-steps/StepOutputTextField.tsx';
import { slimEcPublicJwk } from '@/crypto/ecPublicKey.ts';
import type { CopyState } from '@/types/copyState.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import { downloadJsonFile } from '@/utils/downloadJson.ts';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';
import { publicKeyDownloadFilename } from '@/utils/privateKeyFilename.ts';

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

  const exportablePublicKeyJwk = useMemo(() => {
    const parsed = parsePublicKeyText(publicKeyJwkText);
    if (parsed.ok === false) {
      return null;
    }
    return slimEcPublicJwk(parsed.jwk);
  }, [publicKeyJwkText]);

  const exportFilename = useMemo(() => {
    const username = title.replace(/\s*-\s*public key\s*$/i, '').trim();
    return publicKeyDownloadFilename(username);
  }, [title]);

  const canExport = Boolean(exportablePublicKeyJwk && !jwkError);

  const handleClose = useCallback(() => {
    onClose();
    setCopyState('idle');
  }, [onClose]);

  const handleCopyPublicKey = useCallback(async () => {
    try {
      await copyTextToClipboard(publicKeyJwkText);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [publicKeyJwkText]);

  const handleExportPublicKey = useCallback(() => {
    if (!exportablePublicKeyJwk) {
      return;
    }
    downloadJsonFile(exportablePublicKeyJwk, exportFilename);
  }, [exportablePublicKeyJwk, exportFilename]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <StepOutputTextField
          label="Public key (x;y)"
          value={publicKeyJwkText}
          slotProps={{
            input: { readOnly: true },
          }}
          multiline
          rows={2}
          fullWidth
          error={Boolean(jwkError)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} sx={{ mr: 'auto' }}>
          Close
        </Button>
        <Button
          variant="outlined"
          color={copyState === 'ok' ? 'success' : 'primary'}
          onClick={() => void handleCopyPublicKey()}
          disabled={!canExport}
        >
          {copyButtonLabel}
        </Button>
        <Button
          variant="contained"
          onClick={handleExportPublicKey}
          disabled={!canExport}
          startIcon={<FileDownloadOutlinedIcon />}
        >
          Export file
        </Button>
      </DialogActions>
    </Dialog>
  );
}
