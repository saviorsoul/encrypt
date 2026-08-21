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
import { AcceptInvitationDialog } from '@encrypt/ui/AcceptInvitationDialog';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { feedAppBackgroundSx } from '@encrypt/ui/feedTheme';
import { isFeedLabProtocolBridgeEnabled } from '@encrypt/core/feed/feedLabBridgeConfig';

const protocolBridgeEnabled = isFeedLabProtocolBridgeEnabled();

export function LoginPage() {
  const { keys } = useFeedLabSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [acceptInvitationOpen, setAcceptInvitationOpen] = useState(false);

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

  const handleInvitationIdSubmit = useCallback(
    (token: string) => {
      setAcceptInvitationOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

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
          {protocolBridgeEnabled ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Use the Encrypt system app to sign requests without loading your
                private key into this browser, or choose a private key file.
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={pairBusy || busy}
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
          ) : (
            <Typography variant="body2" color="text.secondary">
              Choose a private key file to sign in. Connect via the Encrypt
              system app is disabled in this build.
            </Typography>
          )}
          {keys.sessionError ? (
            <Alert severity="error">{keys.sessionError}</Alert>
          ) : null}
          <Typography variant="body2">
            Choose a <strong>.jwk</strong> or <strong>.json</strong> private key
            file to sign in with a browser-loaded key.
          </Typography>
          <Button
            data-testid="login-choose-private-key-file"
            variant="outlined"
            size="large"
            fullWidth
            disabled={busy || pairBusy}
            onClick={() => void handleChooseFile()}
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {busy ? 'Opening file picker…' : 'Choose private key file'}
          </Button>
          <Divider>or</Divider>
          <Button
            data-testid="login-accept-invitation"
            variant="outlined"
            size="large"
            fullWidth
            disabled={busy || pairBusy}
            onClick={() => setAcceptInvitationOpen(true)}
          >
            Accept invitation
          </Button>
        </Stack>
      </Paper>
      <AcceptInvitationDialog
        open={acceptInvitationOpen}
        onClose={() => setAcceptInvitationOpen(false)}
        onSubmit={handleInvitationIdSubmit}
        qrScanAvailable={false}
      />
    </Box>
  );
}
