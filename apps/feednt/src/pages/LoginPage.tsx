import { useCallback, useState } from 'react';
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
import { feedAppBackgroundSx } from '@encrypt/ui/feedTheme';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

export function LoginPage() {
  const { session, sessionError, unlock, importKey } = useFeedntSession();
  const navigate = useNavigate();
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

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

  if (session?.keyId) {
    return <Navigate to="/feed" replace />;
  }

  const busy = unlockBusy || importBusy;

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
          <Typography variant="body2" color="text.secondary">
            Unlock the private key stored in this device&apos;s secure storage
            to read your feed inbox.
          </Typography>
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={busy}
            onClick={() => void handleUnlock()}
            startIcon={
              unlockBusy ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {unlockBusy ? 'Unlocking…' : 'Unlock private key'}
          </Button>
          <Divider>or</Divider>
          <Typography variant="body2">
            Choose a <strong>.jwk</strong> or <strong>.json</strong> private key
            file to import into secure storage on this device.
          </Typography>
          <Button
            variant="outlined"
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
        </Stack>
      </Paper>
    </Box>
  );
}
