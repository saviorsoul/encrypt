import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Navigate, useNavigate } from 'react-router-dom';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

export function LoginPage() {
  const { keys } = useFeedLabSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

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

  if (keys.keyId) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ p: 3, maxWidth: 444, width: '100%' }}>
        <Typography variant="h6" component="h1" gutterBottom>
          Sign in with private key
        </Typography>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            To use Feed Lab, select the private key file for the account you
            want to sign in with.
          </Typography>
          <Typography variant="body2">
            Click the button below to open your file picker and choose a{' '}
            <strong>.jwk</strong> or <strong>.json</strong> private key file.
          </Typography>
          {keys.sessionError ? (
            <Alert severity="error">{keys.sessionError}</Alert>
          ) : null}
          <Button
            variant="contained"
            size="large"
            fullWidth
            autoFocus
            disabled={busy}
            onClick={() => void handleChooseFile()}
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {busy ? 'Opening file picker…' : 'Choose private key file'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
