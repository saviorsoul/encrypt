import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { usePublicKeyJwkInput } from '@/hooks/usePublicKeyJwkInput.ts';

type SaveRecipientDialogProps = {
  open: boolean;
  onClose: () => void;
  existingUsernames: string[];
  existingUsers?: Array<{ keyId: string; username: string }>;
  saving: boolean;
  error: string | null;
  onSave: (name: string, publicKeyJwkText: string) => void;
  onFieldChange?: () => void;
};

export function SaveRecipientDialog({
  open,
  onClose,
  existingUsernames,
  existingUsers = [],
  saving,
  error,
  onSave,
  onFieldChange,
}: SaveRecipientDialogProps) {
  const [name, setName] = useState('');
  const [publicKeyJwkText, setPublicKeyJwkText] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName('');
      setPublicKeyJwkText('');
    }
  }

  const trimmedName = name.trim();
  const nameExists =
    trimmedName.length > 0 && existingUsernames.includes(trimmedName);
  const duplicateError = nameExists
    ? `"${trimmedName}" already exists. Choose a unique name.`
    : null;

  const publicKeyInput = usePublicKeyJwkInput(publicKeyJwkText);

  const duplicateKeyUser =
    publicKeyInput.keyId != null
      ? existingUsers.find((user) => user.keyId === publicKeyInput.keyId)
      : undefined;
  const duplicateKeyError = duplicateKeyUser
    ? `This public key is already saved as "${duplicateKeyUser.username}".`
    : null;

  const publicKeyHelperText =
    publicKeyInput.jwkError ??
    duplicateKeyError ??
    (publicKeyInput.importing
      ? 'Validating public key…'
      : 'Paste the recipient public key as x;y.');

  const canSave =
    trimmedName.length > 0 &&
    publicKeyInput.isValid &&
    !saving &&
    !nameExists &&
    !duplicateKeyUser;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add recipient</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Recipient name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onFieldChange?.();
          }}
          fullWidth
          margin="dense"
          disabled={saving}
          error={Boolean(duplicateError)}
          helperText={duplicateError}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) {
              onSave(trimmedName, publicKeyJwkText);
            }
          }}
        />
        <TextField
          label="Public key (x;y)"
          value={publicKeyJwkText}
          onChange={(e) => {
            setPublicKeyJwkText(e.target.value);
            onFieldChange?.();
          }}
          fullWidth
          margin="dense"
          disabled={saving}
          error={Boolean(publicKeyInput.jwkError || duplicateKeyError)}
          helperText={publicKeyHelperText}
          slotProps={{
            input: {
              sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
            },
          }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() => onSave(trimmedName, publicKeyJwkText)}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
