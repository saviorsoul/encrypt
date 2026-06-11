import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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

type ChangeRecipientDialogProps = {
  open: boolean;
  onClose: () => void;
  usernames: string[];
  loading: boolean;
  loadingSelection: boolean;
  error: string | null;
  selectedUsername: string | null;
  onSelect: (username: string) => void;
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
}: ChangeRecipientDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slots={{ transition: SlideUpTransition }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Change recipient</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
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
            No stored users available.
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
                  onClose();
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
