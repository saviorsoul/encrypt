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
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import {
  usePrivateKeyOnboardingGuard,
  type PrivateKeyOnboardingGuardStatus,
} from '@/hooks/usePrivateKeyOnboardingGuard.ts';
import {
  listStoredUsernames,
  loadStoredPublicKeyMaterialByKeyId,
  saveStoredRecipientForUsername,
} from '@/services/db/storedPublicKeys.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { useNavigate } from 'react-router-dom';

type ExternalAddRecipientDialogProps = {
  fileName: string;
  jwk: JsonWebKey;
  onClose: () => void;
  onSaved: () => void;
};

function getPublicKeyDisabledReason(
  user: { username: string } | null,
  onboardingStatus: PrivateKeyOnboardingGuardStatus,
): string | null {
  if (!user) {
    return 'Sign in first to save a recipient public key.';
  }

  switch (onboardingStatus) {
    case 'loading':
      return 'Checking account status…';
    case 'required':
      return 'Finish saving your private key before adding recipients.';
    case 'recovery':
      return 'Restore your account with your private key before adding recipients.';
    case 'error':
      return 'Could not verify account status. Refresh and try again.';
    default:
      return null;
  }
}

export function ExternalAddRecipientDialog({
  fileName,
  jwk,
  onClose,
  onSaved,
}: ExternalAddRecipientDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const onboardingStatus = usePrivateKeyOnboardingGuard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');

  const canSavePublicKey =
    user !== null &&
    onboardingStatus !== 'loading' &&
    onboardingStatus !== 'required' &&
    onboardingStatus !== 'recovery' &&
    onboardingStatus !== 'error';

  const publicKeyDisabledReason = getPublicKeyDisabledReason(
    user,
    onboardingStatus,
  );

  const handleDismiss = useCallback(() => {
    if (busy) {
      return;
    }
    onClose();
  }, [busy, onClose]);

  const handleSave = useCallback(() => {
    const trimmedName = recipientName.trim();
    if (!trimmedName) {
      setError('Enter a recipient name.');
      return;
    }

    setError(null);
    setBusy(true);

    void (async () => {
      try {
        const existingNames = await listStoredUsernames();
        if (existingNames.includes(trimmedName)) {
          setError(`"${trimmedName}" already exists. Choose a unique name.`);
          return;
        }

        const keyId = await ecPublicJwkThumbprintSha256(slimEcPublicJwk(jwk));
        const existingKey = await loadStoredPublicKeyMaterialByKeyId(keyId);
        if (existingKey) {
          setError(
            existingKey.username
              ? `This public key is already saved as "${existingKey.username}".`
              : 'This public key is already stored.',
          );
          return;
        }

        await saveStoredRecipientForUsername(trimmedName, jwk);
        onSaved();
        navigate('/', { replace: true });
      } catch (caught) {
        setError(errorMessage(caught, 'Failed to add recipient.'));
      } finally {
        setBusy(false);
      }
    })();
  }, [jwk, navigate, onSaved, recipientName]);

  return (
    <AppDialog open fullWidth maxWidth="sm">
      <DialogTitle>Add recipient from public key</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Save the public key from{' '}
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 600 }}
            >
              {fileName}
            </Typography>{' '}
            as a recipient you can encrypt messages for.
          </Typography>
          <TextField
            autoFocus
            label="Recipient name"
            value={recipientName}
            onChange={(event) => {
              setRecipientName(event.target.value);
              setError(null);
            }}
            fullWidth
            required
            disabled={busy || !canSavePublicKey}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSavePublicKey && !busy) {
                handleSave();
              }
            }}
          />
          {publicKeyDisabledReason ? (
            <Alert severity="info">{publicKeyDisabledReason}</Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleDismiss} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={busy || !canSavePublicKey || !recipientName.trim()}
          onClick={handleSave}
        >
          {busy ? 'Saving…' : 'Add recipient'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
