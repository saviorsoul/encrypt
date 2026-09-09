import { useCallback, useEffect, useState } from 'react';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Navigate, useNavigate } from 'react-router-dom';
import { generatePrivateKeyDownloadFile } from '@encrypt/core/crypto/privateKeyDownload';
import { hasStoredPrivateKeyInSafeStorage } from '@encrypt/platform/feednt';
import { AcceptInvitationDialog } from '@encrypt/ui/AcceptInvitationDialog';
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { feedAppBackgroundSx } from '@encrypt/ui/feedTheme';
import { FeedntInvitationQrScan } from '@feednt/components/FeedntInvitationQrScan.tsx';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

const DEFAULT_KEY_USERNAME = 'my';

export function LoginPage() {
  const { session, sessionError, unlock, importKey } = useFeedntSession();
  const navigate = useNavigate();
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [hasStoredKey, setHasStoredKey] = useState<boolean | null>(null);
  const [acceptInvitationOpen, setAcceptInvitationOpen] = useState(false);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [downloadSnackbarOpen, setDownloadSnackbarOpen] = useState(false);
  const [downloadSnackbarMessage, setDownloadSnackbarMessage] = useState('');
  const [downloadSnackbarSeverity, setDownloadSnackbarSeverity] = useState<
    'success' | 'warning'
  >('success');
  const [downloadSnackbarKey, setDownloadSnackbarKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void hasStoredPrivateKeyInSafeStorage().then((stored) => {
      if (!cancelled) {
        setHasStoredKey(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnlock = useCallback(async () => {
    setUnlockBusy(true);
    try {
      const ok = await unlock();
      if (ok) {
        navigate('/feed', { replace: true });
      }
    } finally {
      setUnlockBusy(false);
    }
  }, [navigate, unlock]);

  const handleImport = useCallback(async () => {
    setImportBusy(true);
    try {
      const ok = await importKey();
      if (ok) {
        navigate('/feed', { replace: true });
      }
    } finally {
      setImportBusy(false);
    }
  }, [importKey, navigate]);

  const handleGenerateKey = useCallback(async () => {
    setGenerateError(null);
    setGenerateBusy(true);
    try {
      const result = await generatePrivateKeyDownloadFile(DEFAULT_KEY_USERNAME);
      setDownloadSnackbarMessage(result.message);
      setDownloadSnackbarSeverity(
        result.outcome === 'saved' ? 'success' : 'warning',
      );
      setDownloadSnackbarKey((key) => key + 1);
      setDownloadSnackbarOpen(true);
    } catch (error) {
      if (error instanceof Error && error.message === 'Save cancelled.') {
        return;
      }
      setGenerateError(
        error instanceof Error
          ? error.message
          : 'Failed to generate private key.',
      );
    } finally {
      setGenerateBusy(false);
    }
  }, []);

  const handleQrTokenScanned = useCallback(
    (token: string) => {
      setQrScanOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  const handleQrScanRequest = useCallback(() => {
    setAcceptInvitationOpen(false);
    setQrScanOpen(true);
  }, []);

  const handleInvitationIdSubmit = useCallback(
    (token: string) => {
      setAcceptInvitationOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  if (session?.keyId) {
    return <Navigate to="/feed" replace />;
  }

  const busy = unlockBusy || importBusy || generateBusy;

  return (
    <Box
      sx={[
        feedAppBackgroundSx,
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Paper sx={{ p: 3, maxWidth: 444, width: '100%' }}>
        <Typography variant="h6" component="h1" gutterBottom>
          Sign in
        </Typography>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {hasStoredKey === false ? (
            <Typography variant="body2" color="text.secondary">
              Import a private key to sign in, or use the options below to
              generate a key file or accept an invitation.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Unlock the private key stored in this device&apos;s secure storage
              to read your feed inbox.
            </Typography>
          )}
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}
          {generateError ? (
            <Alert severity="error">{generateError}</Alert>
          ) : null}
          {hasStoredKey === true ? (
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={busy}
              onClick={() => void handleUnlock()}
              startIcon={
                unlockBusy ? (
                  <CircularProgress size={18} color="inherit" />
                ) : null
              }
            >
              {unlockBusy ? 'Unlocking…' : 'Unlock private key'}
            </Button>
          ) : null}
          {hasStoredKey === false ? (
            <>
              <Typography variant="body2">
                Choose a <strong>.jwk</strong> or <strong>.json</strong> private
                key file to import into secure storage on this device.
              </Typography>
              <Button
                data-testid="login-choose-private-key-file"
                variant="contained"
                size="large"
                fullWidth
                disabled={busy}
                onClick={() => void handleImport()}
                startIcon={
                  importBusy ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <UploadFileOutlinedIcon />
                  )
                }
              >
                {importBusy ? 'Opening file picker…' : 'Import private key'}
              </Button>
              <Divider>or</Divider>
              <Button
                data-testid="login-generate-key-pair"
                variant="outlined"
                size="large"
                fullWidth
                disabled={busy}
                onClick={() => void handleGenerateKey()}
                startIcon={
                  generateBusy ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : null
                }
              >
                {generateBusy ? 'Generating…' : 'Generate new key pair'}
              </Button>
              <Button
                data-testid="login-accept-invitation"
                variant="outlined"
                size="large"
                fullWidth
                disabled={busy}
                onClick={() => setAcceptInvitationOpen(true)}
              >
                Accept invite
              </Button>
            </>
          ) : null}
        </Stack>
      </Paper>
      <AcceptInvitationDialog
        open={acceptInvitationOpen}
        onClose={() => setAcceptInvitationOpen(false)}
        onSubmit={handleInvitationIdSubmit}
        qrScanAvailable
        onQrScanRequest={handleQrScanRequest}
      />
      <FeedntInvitationQrScan
        open={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        onTokenScanned={handleQrTokenScanned}
      />
      <CopiedToClipboardSnackbar
        open={downloadSnackbarOpen}
        severity={downloadSnackbarSeverity}
        onClose={() => setDownloadSnackbarOpen(false)}
        snackbarKey={downloadSnackbarKey}
        successMessage={downloadSnackbarMessage}
        errorMessage={downloadSnackbarMessage}
      />
    </Box>
  );
}
