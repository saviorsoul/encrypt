import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

type NameUnknownRecipientDialogProps = {
  open: boolean;
  onClose: () => void;
  existingUsernames: string[];
  saving: boolean;
  error: string | null;
  onSave: (username: string) => void;
  onNameChange?: () => void;
  stacked?: boolean;
};

export function NameUnknownRecipientDialog({
  open,
  onClose,
  existingUsernames,
  saving,
  error,
  onSave,
  onNameChange,
  stacked = false,
}: NameUnknownRecipientDialogProps) {
  const [name, setName] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName('');
    }
  }

  const trimmedName = name.trim();
  const nameExists =
    trimmedName.length > 0 && existingUsernames.includes(trimmedName);
  const duplicateError = nameExists
    ? `"${trimmedName}" already exists. Choose a unique name.`
    : null;
  const displayError = duplicateError ?? error;
  const canSave = trimmedName.length > 0 && !saving && !nameExists;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      {...(stacked ? { disableEscapeKeyDown: saving } : {})}
    >
      <DialogTitle>Name recipient</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Recipient name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onNameChange?.();
          }}
          fullWidth
          margin="dense"
          disabled={saving}
          error={Boolean(displayError)}
          helperText={
            displayError ??
            'This message belongs to a different conversation. Name the other party to save them.'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) {
              onSave(trimmedName);
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() => onSave(trimmedName)}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
