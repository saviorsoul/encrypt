import React, { useEffect, useRef, useState } from 'react';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import {
  lookupPrivateKeyUser,
  resolveUsernameFromPrivateKeyJwk,
} from '@/crypto/loginFromPrivateKey.ts';
import { readPrivateKeyJwkFromFile } from '@/crypto/privateKeyFile.ts';
import { LAST_USERNAME_STORAGE_KEY } from '@/components/providers/AuthProvider.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { usernameFromPrivateKeyFilename } from '@/utils/privateKeyFilename.ts';

type LoginMode = 'type' | 'stored' | 'privateKey';

const USERNAME_TAKEN_MESSAGE = 'That username is already taken.';

function readLastUsername(): string {
  try {
    return localStorage.getItem(LAST_USERNAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { allUsernames, loading: loadingUsers } = useStoredUsernames();
  const [loginMode, setLoginMode] = useState<LoginMode>('type');
  const [username, setUsername] = useState(readLastUsername);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [storedLoginInitialized, setStoredLoginInitialized] = useState(false);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [privateKeyFileName, setPrivateKeyFileName] = useState<string | null>(
    null,
  );
  const [privateKeyNeedsUsername, setPrivateKeyNeedsUsername] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!storedLoginInitialized && !loadingUsers && allUsernames.length > 0) {
    const last = readLastUsername().trim();
    if (last && allUsernames.includes(last)) {
      setLoginMode('stored');
      setUsername(last);
    }
    setStoredLoginInitialized(true);
  }

  const hasStoredUsers = allUsernames.length > 0;

  const isUsernameTaken = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return allUsernames.some(
      (stored) => stored.toLowerCase() === trimmed.toLowerCase(),
    );
  };

  const handleNewUsernameChange = (value: string) => {
    setUsername(value);
    if (hasStoredUsers && isUsernameTaken(value)) {
      setUsernameError(USERNAME_TAKEN_MESSAGE);
    } else {
      clearErrors();
    }
  };

  const clearErrors = () => {
    if (usernameError) setUsernameError(null);
  };

  const resetPrivateKeyState = () => {
    setPrivateKeyFile(null);
    setPrivateKeyFileName(null);
    setPrivateKeyNeedsUsername(false);
  };

  const handleModeChange = (
    _: React.MouseEvent<HTMLElement>,
    next: LoginMode | null,
  ) => {
    if (!next) return;
    setLoginMode(next);
    if (next !== 'privateKey') {
      resetPrivateKeyState();
    }
    if (next === 'type' && hasStoredUsers && isUsernameTaken(username)) {
      setUsernameError(USERNAME_TAKEN_MESSAGE);
    } else {
      clearErrors();
    }
  };

  const openPrivateKeyPicker = () => {
    fileInputRef.current?.click();
  };

  const completePrivateKeyLogin = async (
    privateJwk: JsonWebKey,
    usernameHint?: string,
  ) => {
    const result = await resolveUsernameFromPrivateKeyJwk(
      privateJwk,
      usernameHint,
    );
    login(result.username, { existingUser: result.existingUser });
    navigate('/', { replace: true });
  };

  const handlePrivateKeyFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      resetPrivateKeyState();
      return;
    }

    setPrivateKeyFile(file);
    setPrivateKeyFileName(file.name);
    clearErrors();
    setSubmitting(true);

    void (async () => {
      try {
        const privateJwk = await readPrivateKeyJwkFromFile(file);
        const lookup = await lookupPrivateKeyUser(privateJwk);

        if (lookup.status === 'known') {
          setPrivateKeyNeedsUsername(false);
          await completePrivateKeyLogin(privateJwk);
          return;
        }

        setPrivateKeyNeedsUsername(true);
        const guessedUsername = usernameFromPrivateKeyFilename(file.name);
        if (guessedUsername) {
          setUsername(guessedUsername);
        }
      } catch (error) {
        resetPrivateKeyState();
        setUsernameError(
          errorMessage(error, 'Could not sign in with that private key.'),
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loginMode === 'privateKey') {
      if (!privateKeyFile) {
        setUsernameError('Choose your private key file.');
        return;
      }

      if (!privateKeyNeedsUsername) {
        return;
      }

      const trimmed = username.trim();
      if (!trimmed) {
        setUsernameError('Enter your username.');
        return;
      }

      setSubmitting(true);
      setUsernameError(null);
      try {
        const privateJwk = await readPrivateKeyJwkFromFile(privateKeyFile);
        await completePrivateKeyLogin(privateJwk, username);
      } catch (error) {
        setUsernameError(
          errorMessage(error, 'Could not sign in with that private key.'),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameError(
        loginMode === 'stored' ? 'Select a stored user' : 'Enter a username',
      );
      return;
    }
    if (loginMode === 'type' && hasStoredUsers && isUsernameTaken(trimmed)) {
      setUsernameError(USERNAME_TAKEN_MESSAGE);
      return;
    }
    setUsernameError(null);
    login(trimmed);
    navigate('/', { replace: true });
  };

  const showSignInButton =
    loginMode !== 'privateKey' || !privateKeyFile || privateKeyNeedsUsername;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }} elevation={2}>
        <Typography variant="h6" gutterBottom align="center">
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {loginMode === 'privateKey'
            ? privateKeyNeedsUsername
              ? 'Enter the username for this private key on this device.'
              : 'Choose your private key file to sign in.'
            : 'Enter a username or pick one already created. The session is stored for the current tab.'}
        </Typography>
        <Box
          component="form"
          onSubmit={(event) => void handleSubmit(event)}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <ToggleButtonGroup
            value={loginMode}
            exclusive
            onChange={handleModeChange}
            fullWidth
            size="small"
            aria-label="Sign-in method"
          >
            <ToggleButton
              value="type"
              aria-label={hasStoredUsers ? 'Create new user' : 'Type username'}
            >
              {hasStoredUsers ? 'New user' : 'Username'}
            </ToggleButton>
            {hasStoredUsers ? (
              <ToggleButton value="stored" aria-label="Choose stored user">
                Users
              </ToggleButton>
            ) : null}
            <ToggleButton
              value="privateKey"
              aria-label="Sign in with private key"
            >
              Private key
            </ToggleButton>
          </ToggleButtonGroup>

          {loginMode === 'privateKey' ? (
            <Stack spacing={1}>
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
                sx={{ fontSize: '0.875rem' }}
              >
                {submitting
                  ? 'Signing in…'
                  : privateKeyFileName
                    ? privateKeyFileName
                    : 'Choose private key file'}
              </Button>
              {privateKeyNeedsUsername ? (
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearErrors();
                  }}
                  fullWidth
                  required
                  autoComplete="username"
                  disabled={submitting}
                />
              ) : null}
              {usernameError ? (
                <Alert severity="error">{usernameError}</Alert>
              ) : null}
            </Stack>
          ) : loginMode === 'stored' && hasStoredUsers ? (
            <FormControl fullWidth required error={!!usernameError}>
              <InputLabel id="login-stored-user-label">Username</InputLabel>
              <Select
                labelId="login-stored-user-label"
                label="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearErrors();
                }}
                disabled={loadingUsers}
              >
                {allUsernames.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
              {usernameError ? (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.5, ml: 1.75 }}
                >
                  {usernameError}
                </Typography>
              ) : null}
            </FormControl>
          ) : (
            <TextField
              label={hasStoredUsers ? 'New username' : 'Username'}
              value={username}
              onChange={(e) => handleNewUsernameChange(e.target.value)}
              fullWidth
              required
              autoComplete="username"
              error={!!usernameError}
              helperText={usernameError}
            />
          )}

          {showSignInButton ? (
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={
                submitting ||
                (loginMode === 'type' && Boolean(usernameError)) ||
                (loginMode === 'privateKey' && !privateKeyFile)
              }
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          ) : null}
        </Box>
      </Paper>
    </Box>
  );
}
