import React, { useCallback, useState } from 'react';
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
import { AcceptInvitationDialog } from '@encrypt/ui/AcceptInvitationDialog';
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { GdprConsentCheckbox } from '@encrypt/ui/GdprConsentCheckbox';
import { LazyInvitationQrScanDialog } from '@encrypt/ui/LazyInvitationQrScanDialog';
import { isFeedInvitationalOnlyEnabled } from '@encrypt/ui';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { resolveDefaultInviteUsername } from '@lab/lib/defaultInviteUsername.ts';
import { feedAppBackgroundSx } from '@encrypt/ui/feedTheme';
import { isFeedLabProtocolBridgeEnabled } from '@encrypt/core/feed/feedLabBridgeConfig';

const protocolBridgeEnabled = isFeedLabProtocolBridgeEnabled();

export function LoginPage() {
  const { keys } = useFeedLabSession();
  const feedInvitationalOnly = isFeedInvitationalOnlyEnabled();
  const requiresGdprConsent = !feedInvitationalOnly;
  const navigate = useNavigate();
  const [gdprConsent, setGdprConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [acceptInvitationOpen, setAcceptInvitationOpen] = useState(false);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [downloadSnackbarOpen, setDownloadSnackbarOpen] = useState(false);
  const [downloadSnackbarMessage, setDownloadSnackbarMessage] = useState('');
  const [downloadSnackbarSeverity, setDownloadSnackbarSeverity] = useState<
    'success' | 'warning'
  >('success');
  const [downloadSnackbarKey, setDownloadSnackbarKey] = useState(0);
  const actionBusy = busy || pairBusy || generateBusy;
  const signInBlocked = requiresGdprConsent && !gdprConsent;

  const handleChooseFile = useCallback(async () => {
    keys.clearSessionError();
    setBusy(true);
    try {
      const keyId = await keys.changeKeyId();
      if (keyId) {
        navigate('/feed', { replace: true });
      }
    } finally {
      setBusy(false);
    }
  }, [keys, navigate]);

  const handleConnectEncryptApp = useCallback(async () => {
    keys.clearSessionError();
    setPairBusy(true);
    try {
      const keyId = await keys.pairWithEncryptApp();
      if (keyId) {
        navigate('/feed', { replace: true });
      }
    } finally {
      setPairBusy(false);
    }
  }, [keys, navigate]);

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

  const handleGenerateKeyPair = useCallback(async () => {
    keys.clearSessionError();
    setGenerateError(null);
    setGenerateBusy(true);
    try {
      const username = await resolveDefaultInviteUsername(null);
      const result = await generatePrivateKeyDownloadFile(username);
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
  }, [keys]);

  if (keys.keyId) {
    return <Navigate to="/feed" replace />;
  }

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
          <Alert severity="warning">
            You&apos;re using Feed Lab. Keys you generate or load in the browser
            should not be considered secure - they are by design kept as a
            plaintext in your regular filesystem. Using the Feed API in a
            browser is for demonstration only: to check what the app does before
            installing native Desktop or Mobile Feedn't application.
          </Alert>
          {protocolBridgeEnabled && (
            <>
              <Typography variant="body2" color="text.secondary">
                Connect via the Encrypt system app or choose a private key file
                to sign in.
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={actionBusy || signInBlocked}
                onClick={() => void handleConnectEncryptApp()}
                startIcon={
                  pairBusy ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : null
                }
              >
                {pairBusy ? 'Waiting for Encrypt app…' : 'Connect Encrypt app'}
              </Button>
              <Divider>or</Divider>
            </>
          )}
          {keys.sessionError ? (
            <Alert severity="error">{keys.sessionError}</Alert>
          ) : null}
          {generateError ? (
            <Alert severity="error">{generateError}</Alert>
          ) : null}
          {requiresGdprConsent ? (
            <GdprConsentCheckbox
              purpose="login"
              checked={gdprConsent}
              onChange={setGdprConsent}
              disabled={actionBusy}
              openGdprInNewTab
            />
          ) : null}
          <Button
            data-testid="login-choose-private-key-file"
            variant={protocolBridgeEnabled ? 'outlined' : 'contained'}
            size="large"
            fullWidth
            disabled={actionBusy || signInBlocked}
            onClick={() => void handleChooseFile()}
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {busy ? 'Opening file picker…' : 'Choose private key file'}
          </Button>
          <Divider>or</Divider>
          <Button
            data-testid="login-generate-key-pair"
            variant="outlined"
            size="large"
            fullWidth
            disabled={actionBusy}
            onClick={() => void handleGenerateKeyPair()}
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
            disabled={actionBusy}
            onClick={() => setAcceptInvitationOpen(true)}
          >
            Enter code
          </Button>
        </Stack>
      </Paper>
      <AcceptInvitationDialog
        open={acceptInvitationOpen}
        onClose={() => setAcceptInvitationOpen(false)}
        onSubmit={handleInvitationIdSubmit}
        qrScanAvailable
        onQrScanRequest={handleQrScanRequest}
      />
      <LazyInvitationQrScanDialog
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
