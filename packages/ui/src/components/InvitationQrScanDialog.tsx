import { useCallback, useEffect, useRef, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { parseScannedInvitationUuid } from '@encrypt/core/invite/invitationLink';
import { Html5Qrcode } from 'html5-qrcode';

const SCANNER_ELEMENT_ID = 'invitation-qr-scanner';

export type InvitationQrScanDialogProps = {
  open: boolean;
  onClose: () => void;
  onTokenScanned: (token: string) => void;
};

export function InvitationQrScanDialog({
  open,
  onClose,
  onTokenScanned,
}: InvitationQrScanDialogProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [invalidScanError, setInvalidScanError] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const handledScanRef = useRef(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      return;
    }
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* ignore stop errors during teardown */
    }
  }, []);

  const handleClose = useCallback(() => {
    void stopScanner();
    setCameraError(null);
    setInvalidScanError(null);
    setScannerReady(false);
    handledScanRef.current = false;
    onClose();
  }, [onClose, stopScanner]);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setScannerReady(false);
      setCameraError(null);
      setInvalidScanError(null);
      handledScanRef.current = false;
      return;
    }
  }, [open, stopScanner]);

  useEffect(() => {
    if (!open || !scannerReady) {
      return;
    }

    const mount = document.getElementById(SCANNER_ELEMENT_ID);
    if (!mount) {
      setCameraError('Could not start camera scanner.');
      return;
    }

    let cancelled = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    void scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledScanRef.current || cancelled) {
            return;
          }

          const token = parseScannedInvitationUuid(decodedText);
          if (!token) {
            setInvalidScanError(
              'QR code is not a valid invitation UUID. Scan an invitation QR code.',
            );
            return;
          }

          handledScanRef.current = true;
          void stopScanner();
          onTokenScanned(token);
        },
        () => {
          /* ignore per-frame scan misses */
        },
      )
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Could not access the camera.';
        setCameraError(message);
      });

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, onTokenScanned, scannerReady, stopScanner]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        transition: {
          onEntered: () => setScannerReady(true),
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        Scan invitation QR code
        <IconButton
          aria-label="Close"
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Point your camera at an invitation QR code.
        </Typography>
        {cameraError ? (
          <Alert severity="error" sx={{ mb: 2 }}>{cameraError}</Alert>
        ) : null}
        {invalidScanError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>{invalidScanError}</Alert>
        ) : null}
        <Box
          id={SCANNER_ELEMENT_ID}
          sx={{
            width: '100%',
            minHeight: 280,
            bgcolor: 'action.hover',
            borderRadius: 1,
            overflow: 'hidden',
            '& video': { borderRadius: 1 },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
