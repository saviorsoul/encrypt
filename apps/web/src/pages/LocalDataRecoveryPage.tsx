import React, { useRef, useState } from 'react';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Navigate, useNavigate } from 'react-router-dom';
import { resolveUsernameFromPrivateKeyJwk } from '@/crypto/loginFromPrivateKey.ts';
import { readPrivateKeyJwkFromFile } from '@/crypto/privateKeyFile.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { usePrivateKeyOnboardingGuard } from '@/hooks/usePrivateKeyOnboardingGuard.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { usernameFromPrivateKeyFilename } from '@/utils/privateKeyFilename.ts';

export function LocalDataRecoveryPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const onboardingStatus = usePrivateKeyOnboardingGuard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [privateKeyFileName, setPrivateKeyFileName] = useState<string | null>(
    null,
  );
  const [username, setUsername] = useState(user?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (onboardingStatus === 'loading') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress aria-label="Checking account status" />
      </Box>
    );
  }
  if (onboardingStatus === 'complete') {
    return <Navigate to="/" replace />;
  }
  if (onboardingStatus === 'required') {
    return <Navigate to="/save-private-key" replace />;
  }
  if (onboardingStatus === 'error') {
    return <Navigate to="/login" replace />;
  }

  const openPrivateKeyPicker = () => {
    fileInputRef.current?.click();
  };

  const handlePrivateKeyFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      setPrivateKeyFile(null);
      setPrivateKeyFileName(null);
      return;
    }

    setPrivateKeyFile(file);
    setPrivateKeyFileName(file.name);
    setError(null);

    const guessedUsername = usernameFromPrivateKeyFilename(file.name);
    if (guessedUsername && !username.trim()) {
      setUsername(guessedUsername);
    }
  };

  const handleRecover = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!privateKeyFile) {
      setError('Choose your private key file.');
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Enter your username.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const privateJwk = await readPrivateKeyJwkFromFile(privateKeyFile);
      const result = await resolveUsernameFromPrivateKeyJwk(
        privateJwk,
        trimmed,
      );

      if (result.username !== user.username) {
        login(result.username, { existingUser: result.existingUser });
      }

      window.location.assign('/');
    } catch (caught) {
      setError(
        errorMessage(caught, 'Could not restore your account with that key.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        px: 2,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 480, width: '100%' }} elevation={2}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography
              variant="h5"
              align="center"
              sx={{ fontFamily: 'monospace' }}
            >
              Local data was cleared
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You are signed in as {user.username}, but this browser no longer
              has your account keys in local storage. Messages and other data
              stored here may also be gone.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Import your private key file to restore your identity on this
              device. The app will not create a new key pair automatically.
            </Typography>
          </Stack>

          <Box
            component="form"
            onSubmit={(event) => void handleRecover(event)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jwk,.json,application/json"
              hidden
              onChange={handlePrivateKeyFileChange}
            />
            <Button
              variant="outlined"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={openPrivateKeyPicker}
              disabled={submitting}
            >
              {privateKeyFileName ?? 'Choose private key file'}
            </Button>
            <TextField
              label="Username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError(null);
              }}
              fullWidth
              required
              autoComplete="username"
              disabled={submitting}
              helperText="It's your responsibility to pick correct private key - there is no validation."
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={submitting || !privateKeyFile}
            >
              {submitting ? 'Restoring…' : 'Restore with private key'}
            </Button>
          </Box>

          <Button
            variant="text"
            color="inherit"
            onClick={handleSignOut}
            disabled={submitting}
          >
            Sign out
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
