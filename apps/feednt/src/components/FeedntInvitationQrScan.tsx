import { useCallback, useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import { parseScannedInvitationUuid } from '@encrypt/core/invite/invitationLink';
import { isCapacitorApp } from '@encrypt/platform/isCapacitorApp';
import { scanInvitationQrCodeNative } from '@feednt/lib/scanInvitationQrCode.ts';
import { InvitationQrScanDialog } from '@encrypt/ui/InvitationQrScanDialog';

type FeedntInvitationQrScanProps = {
  open: boolean;
  onClose: () => void;
  onTokenScanned: (token: string) => void;
};

function FeedntNativeInvitationQrScan({
  open,
  onClose,
  onTokenScanned,
}: FeedntInvitationQrScanProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [invalidScanError, setInvalidScanError] = useState<string | null>(null);
  const [scanFinished, setScanFinished] = useState(false);

  const handleClose = useCallback(() => {
    setCameraError(null);
    setInvalidScanError(null);
    setScanFinished(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCameraError(null);
    setInvalidScanError(null);
    setScanFinished(false);

    let cancelled = false;

    void scanInvitationQrCodeNative().then((result) => {
      if (cancelled) {
        return;
      }

      setScanFinished(true);

      if (result.status === 'scanned') {
        const token = parseScannedInvitationUuid(result.text);
        if (!token) {
          setInvalidScanError(
            'QR code is not a valid invitation UUID. Scan an invitation QR code.',
          );
          return;
        }
        onTokenScanned(token);
        return;
      }

      if (result.status === 'error') {
        setCameraError(result.message);
        return;
      }

      if (result.status === 'unsupported') {
        setCameraError('QR scanning is not supported on this device.');
        return;
      }

      onClose();
    });

    return () => {
      cancelled = true;
    };
  }, [open, onClose, onTokenScanned]);

  if (!open || !scanFinished) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
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
        {cameraError ? <Alert severity="error">{cameraError}</Alert> : null}
        {invalidScanError ? (
          <Alert severity="warning">{invalidScanError}</Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Feednt QR scan: native scanner on mobile, web camera dialog elsewhere. */
export function FeedntInvitationQrScan(props: FeedntInvitationQrScanProps) {
  if (isCapacitorApp()) {
    return <FeedntNativeInvitationQrScan {...props} />;
  }

  return <InvitationQrScanDialog {...props} />;
}
