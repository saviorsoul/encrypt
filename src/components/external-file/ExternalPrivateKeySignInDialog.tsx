import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  lookupPrivateKeyUser,
  resolveUsernameFromPrivateKeyJwk,
} from '@/crypto/loginFromPrivateKey.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { usernameFromPrivateKeyFilename } from '@/utils/privateKeyFilename.ts';
import { useNavigate } from 'react-router-dom';

type ExternalPrivateKeySignInDialogProps = {
  fileName: string;
  jwk: JsonWebKey;
  onClose: () => void;
  onComplete: () => void;
};

type PrivateKeyStep = 'confirm' | 'needsUsername';

export function ExternalPrivateKeySignInDialog({
  fileName,
  jwk,
  onClose,
  onComplete,
}: ExternalPrivateKeySignInDialogProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privateKeyStep, setPrivateKeyStep] =
    useState<PrivateKeyStep>('confirm');
  const [username, setUsername] = useState('');
  const [pendingJwk, setPendingJwk] = useState<JsonWebKey | null>(null);

  const handleDismiss = useCallback(() => {
    if (busy) {
      return;
    }
    onClose();
  }, [busy, onClose]);

  const completePrivateKeyLogin = useCallback(
    async (privateJwk: JsonWebKey, usernameHint?: string) => {
      const result = await resolveUsernameFromPrivateKeyJwk(
        privateJwk,
        usernameHint,
      );
      login(result.username, { existingUser: result.existingUser });
      onComplete();
      navigate('/', { replace: true });
    },
    [login, navigate, onComplete],
  );

  const handleSignIn = useCallback(() => {
    setError(null);
    setBusy(true);

    void (async () => {
      try {
        const lookup = await lookupPrivateKeyUser(jwk);

        if (lookup.status === 'known') {
          await completePrivateKeyLogin(jwk);
          return;
        }

        setPendingJwk(jwk);
        setPrivateKeyStep('needsUsername');
        const guessedUsername = usernameFromPrivateKeyFilename(fileName);
        if (guessedUsername) {
          setUsername(guessedUsername);
        }
      } catch (caught) {
        setError(
          errorMessage(caught, 'Could not sign in with that private key.'),
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [completePrivateKeyLogin, fileName, jwk]);

  const handleUsernameSubmit = useCallback(() => {
    const activeJwk = pendingJwk ?? jwk;
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Enter your username.');
      return;
    }

    setError(null);
    setBusy(true);

    void (async () => {
      try {
        await completePrivateKeyLogin(activeJwk, trimmed);
      } catch (caught) {
        setError(
          errorMessage(caught, 'Could not sign in with that private key.'),
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [completePrivateKeyLogin, jwk, pendingJwk, username]);

  return (
    <AppDialog open fullWidth maxWidth="xs">
      <DialogTitle>Sign in with private key</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {privateKeyStep === 'needsUsername'
              ? 'Enter the username for this private key on this device.'
              : `Use ${fileName} to sign in with your private key.`}
          </Typography>
          {privateKeyStep === 'needsUsername' ? (
            <TextField
              autoFocus
              label="Username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError(null);
              }}
              fullWidth
              required
              autoComplete="username"
              disabled={busy}
            />
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleDismiss} disabled={busy}>
          Cancel
        </Button>
        {privateKeyStep === 'needsUsername' ? (
          <Button
            variant="contained"
            disabled={busy}
            onClick={handleUsernameSubmit}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        ) : (
          <Button variant="contained" disabled={busy} onClick={handleSignIn}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        )}
      </DialogActions>
    </AppDialog>
  );
}
