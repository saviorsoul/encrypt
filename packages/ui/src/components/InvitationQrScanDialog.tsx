import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { parseScannedInvitationUuid } from '@encrypt/core/invite/invitationLink';
import {
  getInvitationQrScannerErrorMessage,
  isInvitationQrScanSupported,
  startInvitationQrScanner,
  type InvitationQrScannerSession,
} from '../lib/invitationQrScanner.ts';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const sessionRef = useRef<InvitationQrScannerSession | null>(null);
  const onTokenScannedRef = useRef(onTokenScanned);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [invalidScanError, setInvalidScanError] = useState<string | null>(null);
  const handledScanRef = useRef(false);

  onTokenScannedRef.current = onTokenScanned;

  const stopScanner = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) {
      return;
    }
    try {
      await session.stop();
    } catch {
      /* ignore stop errors during teardown */
    }
  }, []);

  const handleClose = useCallback(() => {
    void stopScanner();
    setCameraError(null);
    setInvalidScanError(null);
    handledScanRef.current = false;
    onClose();
  }, [onClose, stopScanner]);

  useEffect(() => {
    if (open) {
      return;
    }

    void stopScanner();
    setCameraError(null);
    setInvalidScanError(null);
    handledScanRef.current = false;
  }, [open, stopScanner]);

  useEffect(() => {
    if (!open) {
      setVideoElement(null);
      return;
    }

    setCameraError(null);
    setInvalidScanError(null);
    handledScanRef.current = false;
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !videoElement) {
      return;
    }

    if (!isInvitationQrScanSupported()) {
      setCameraError(getInvitationQrScannerErrorMessage());
      return;
    }

    let cancelled = false;

    void startInvitationQrScanner({
      video: videoElement,
      onDecoded: (decodedText) => {
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
        void (async () => {
          await stopScanner();
          if (!cancelled) {
            onTokenScannedRef.current(token);
          }
        })();
      },
    })
      .then((session) => {
        if (cancelled) {
          void session.stop();
          return;
        }
        sessionRef.current = session;
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : getInvitationQrScannerErrorMessage();
        setCameraError(message);
      });

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, stopScanner, videoElement]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      fullScreen={isMobile}
      maxWidth="sm"
      disableScrollLock
      slotProps={{
        paper: isMobile
          ? { sx: { display: 'flex', flexDirection: 'column' } }
          : undefined,
        transition: {
          timeout: 0,
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
      <DialogContent
        sx={
          isMobile
            ? {
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }
            : undefined
        }
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Point your camera at an invitation QR code.
        </Typography>
        {cameraError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {cameraError}
          </Alert>
        ) : null}
        {invalidScanError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {invalidScanError}
          </Alert>
        ) : null}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            flex: isMobile ? 1 : undefined,
            height: isMobile ? undefined : 280,
            minHeight: isMobile ? 240 : 280,
            bgcolor: 'common.black',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <Box
            component="video"
            ref={setVideoElement}
            autoPlay
            muted
            playsInline
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
