import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { LAST_USERNAME_STORAGE_KEY } from '@/components/providers/AuthProvider.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';

type LoginMode = 'type' | 'stored';

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

  const handleModeChange = (
    _: React.MouseEvent<HTMLElement>,
    next: LoginMode | null,
  ) => {
    if (!next) return;
    setLoginMode(next);
    if (usernameError) setUsernameError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameError(
        loginMode === 'stored' ? 'Select a stored user' : 'Enter a username',
      );
      return;
    }
    setUsernameError(null);
    login(trimmed);
    navigate('/', { replace: true });
  };

  const hasStoredUsers = allUsernames.length > 0;

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
          Enter a username or pick one already created. The session is stored
          for the current tab.
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {hasStoredUsers ? (
            <ToggleButtonGroup
              value={loginMode}
              exclusive
              onChange={handleModeChange}
              fullWidth
              size="small"
              aria-label="Sign-in method"
            >
              <ToggleButton value="type" aria-label="Type username">
                Type username
              </ToggleButton>
              <ToggleButton value="stored" aria-label="Choose stored user">
                Existing users
              </ToggleButton>
            </ToggleButtonGroup>
          ) : null}

          {loginMode === 'stored' && hasStoredUsers ? (
            <FormControl fullWidth required error={!!usernameError}>
              <InputLabel id="login-stored-user-label">Username</InputLabel>
              <Select
                labelId="login-stored-user-label"
                label="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError(null);
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
              label="Username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError(null);
              }}
              fullWidth
              required
              autoComplete="username"
              error={!!usernameError}
              helperText={usernameError}
            />
          )}

          <Button type="submit" variant="contained" fullWidth>
            Sign in
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
