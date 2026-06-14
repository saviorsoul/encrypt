import React, { useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Slide from '@mui/material/Slide';
import Typography from '@mui/material/Typography';
import type { TransitionProps } from '@mui/material/transitions';

const SlideUpTransition = React.forwardRef(function SlideUpTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

type DialogView = 'menu' | 'select';

type ChangeRecipientDialogProps = {
  open: boolean;
  onClose: () => void;
  usernames: string[];
  loading: boolean;
  loadingSelection: boolean;
  error: string | null;
  selectedUsername: string | null;
  onSelect: (username: string) => void;
  onGenerate: () => void;
  onAdd: () => void;
  generateDisabled?: boolean;
  addDisabled?: boolean;
};

export function ChangeRecipientDialog({
  open,
  onClose,
  usernames,
  loading,
  loadingSelection,
  error,
  selectedUsername,
  onSelect,
  onGenerate,
  onAdd,
  generateDisabled = false,
  addDisabled = false,
}: ChangeRecipientDialogProps) {
  const [view, setView] = useState<DialogView>('menu');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setView('menu');
    }
  }

  const handleClose = () => {
    onClose();
  };

  const handlePickGenerate = () => {
    handleClose();
    onGenerate();
  };

  const handlePickAdd = () => {
    handleClose();
    onAdd();
  };

  const title = view === 'menu' ? 'Change recipient' : 'Select saved recipient';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slots={{ transition: SlideUpTransition }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pr: 1,
        }}
      >
        {view !== 'menu' && (
          <IconButton
            edge="start"
            aria-label="Back"
            onClick={() => setView('menu')}
            size="small"
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        {title}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {view === 'menu' ? (
          <List disablePadding>
            <ListItemButton
              disabled={loading}
              onClick={() => setView('select')}
            >
              <ListItemText
                primary="Select from saved users"
                secondary={
                  loading
                    ? 'Loading users…'
                    : usernames.length === 0
                      ? 'No saved users yet'
                      : `${usernames.length} saved user${usernames.length === 1 ? '' : 's'}`
                }
              />
            </ListItemButton>
            <ListItemButton
              disabled={generateDisabled}
              onClick={handlePickGenerate}
            >
              <ListItemText
                primary="Generate new recipient"
                secondary="Create a new key pair and download the private key"
              />
            </ListItemButton>
            <ListItemButton disabled={addDisabled} onClick={handlePickAdd}>
              <ListItemText
                primary="Add recipient"
                secondary="Save an existing public key"
              />
            </ListItemButton>
          </List>
        ) : loading ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}
          >
            <CircularProgress size={16} />
            Loading users…
          </Typography>
        ) : error ? (
          <Typography variant="body2" color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        ) : usernames.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No stored users available. Generate or add a recipient first.
          </Typography>
        ) : (
          <List disablePadding>
            {usernames.map((username) => (
              <ListItemButton
                key={username}
                selected={username === selectedUsername}
                disabled={loadingSelection}
                onClick={() => {
                  onSelect(username);
                  handleClose();
                }}
              >
                <ListItemText primary={username} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
