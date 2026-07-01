import React, { useCallback, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { manifestRecipientFromJwk } from '@lab/lib/manifestRecipientFromJwk.ts';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';

type ShareRecipientEntry = {
  keyId: string;
  label: string;
};

type ShareMessageDialogProps = {
  open: boolean;
  messageId: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onShare: (recipients: ManifestRecipientKeys[]) => Promise<string | null>;
  onClearError: () => void;
};

export function ShareMessageDialog({
  open,
  messageId,
  busy,
  error,
  onClose,
  onShare,
  onClearError,
}: ShareMessageDialogProps) {
  const [publicKeyText, setPublicKeyText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ShareRecipientEntry[]>([]);
  const [recipientKeys, setRecipientKeys] = useState<
    Map<string, ManifestRecipientKeys>
  >(() => new Map());

  const resetForm = useCallback(() => {
    setPublicKeyText('');
    setInputError(null);
    setRecipients([]);
    setRecipientKeys(new Map());
    onClearError();
  }, [onClearError]);

  const handleClose = useCallback(() => {
    if (busy) {
      return;
    }
    resetForm();
    onClose();
  }, [busy, onClose, resetForm]);

  const handleAddRecipient = useCallback(async () => {
    setInputError(null);
    onClearError();

    const parsed = parsePublicKeyText(publicKeyText);
    if (parsed.ok === false) {
      setInputError(parsed.error);
      return;
    }

    try {
      const keyId = await ecPublicJwkThumbprintSha256(
        slimEcPublicJwk(parsed.jwk),
      );
      if (recipientKeys.has(keyId)) {
        setInputError('This public key is already in the list.');
        return;
      }

      const manifestRecipient = await manifestRecipientFromJwk(parsed.jwk);
      setRecipientKeys((current) => {
        const next = new Map(current);
        next.set(keyId, manifestRecipient);
        return next;
      });
      setRecipients((current) => [
        ...current,
        { keyId, label: `${keyId.slice(0, 12)}…` },
      ]);
      setPublicKeyText('');
    } catch (e) {
      setInputError(
        e instanceof Error ? e.message : 'Failed to import public key.',
      );
    }
  }, [onClearError, publicKeyText, recipientKeys]);

  const handleRemoveRecipient = useCallback((keyId: string) => {
    setRecipients((current) =>
      current.filter((recipient) => recipient.keyId !== keyId),
    );
    setRecipientKeys((current) => {
      const next = new Map(current);
      next.delete(keyId);
      return next;
    });
    setInputError(null);
  }, []);

  const handleShare = useCallback(async () => {
    onClearError();
    const selected = recipients
      .map((recipient) => recipientKeys.get(recipient.keyId))
      .filter((value): value is ManifestRecipientKeys => value != null);
    if (selected.length === 0) {
      setInputError('Add at least one recipient public key.');
      return;
    }
    const shareId = await onShare(selected);
    if (shareId) {
      resetForm();
      onClose();
    }
  }, [onClearError, onClose, onShare, recipientKeys, recipients, resetForm]);

  return (
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Share message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Add one or more recipient public keys. Each key can be{' '}
            <Typography
              component="span"
              variant="body2"
              sx={{ fontFamily: 'monospace' }}
            >
              x;y
            </Typography>{' '}
            coordinates, or a JSON object with{' '}
            <Typography
              component="span"
              variant="body2"
              sx={{ fontFamily: 'monospace' }}
            >
              x
            </Typography>{' '}
            and{' '}
            <Typography
              component="span"
              variant="body2"
              sx={{ fontFamily: 'monospace' }}
            >
              y
            </Typography>
            . You will be prompted for your private key when sharing.
          </Typography>

          {messageId ? (
            <Typography variant="caption" color="text.secondary">
              Thread: {messageId}
            </Typography>
          ) : null}

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Recipient public key"
            placeholder='x;y or {"x":"…","y":"…"}'
            value={publicKeyText}
            disabled={busy}
            onChange={(event) => {
              setPublicKeyText(event.target.value);
              setInputError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleAddRecipient();
              }
            }}
          />

          <Button
            variant="outlined"
            disabled={busy || !publicKeyText.trim()}
            onClick={() => void handleAddRecipient()}
          >
            Add recipient
          </Button>

          {recipients.length > 0 ? (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {recipients.map((recipient) => (
                <Chip
                  key={recipient.keyId}
                  label={recipient.label}
                  onDelete={
                    busy
                      ? undefined
                      : () => handleRemoveRecipient(recipient.keyId)
                  }
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No recipients added yet.
            </Typography>
          )}

          {inputError ? <Alert severity="error">{inputError}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={busy || recipients.length === 0}
          onClick={() => void handleShare()}
        >
          {busy ? 'Sharing…' : 'Share'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
