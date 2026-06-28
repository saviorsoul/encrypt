import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

type GenerateRecipientDialogProps = {
  open: boolean;
  onClose: () => void;
  existingUsernames: string[];
  generating: boolean;
  error: string | null;
  onGenerate: (username: string) => void;
  onNameChange?: () => void;
};

export function GenerateRecipientDialog({
  open,
  onClose,
  existingUsernames,
  generating,
  error,
  onGenerate,
  onNameChange,
}: GenerateRecipientDialogProps) {
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
  const canGenerate = trimmedName.length > 0 && !generating && !nameExists;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Generate recipient</DialogTitle>
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
          disabled={generating}
          error={Boolean(displayError)}
          helperText={
            displayError ??
            'A new key pair will be created. The private key file will be downloaded.'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canGenerate) {
              onGenerate(trimmedName);
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={generating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canGenerate}
          onClick={() => onGenerate(trimmedName)}
        >
          Generate
        </Button>
      </DialogActions>
    </Dialog>
  );
}
