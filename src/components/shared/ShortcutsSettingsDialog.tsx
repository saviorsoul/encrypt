import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatAcceleratorForDisplay,
  KEYBOARD_SHORTCUT_DEFINITIONS,
  keyEventToAccelerator,
  type KeyboardShortcutId,
  type KeyboardShortcutsMap,
} from '@/utils/keyboardShortcuts.ts';
import type { KeyboardShortcutsState } from '@/vite-env.d.ts';

type ShortcutsSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

function mergeShortcutsState(
  state: KeyboardShortcutsState,
): KeyboardShortcutsMap {
  return {
    ...DEFAULT_KEYBOARD_SHORTCUTS,
    ...state.shortcuts,
  };
}

export function ShortcutsSettingsDialog({
  open,
  onClose,
}: ShortcutsSettingsDialogProps) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcutsMap>(
    DEFAULT_KEYBOARD_SHORTCUTS,
  );
  const [registration, setRegistration] = useState<Record<string, boolean>>({});
  const [sessionType, setSessionType] = useState('unknown');
  const [recordingId, setRecordingId] = useState<KeyboardShortcutId | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const platform = window.electron?.platform ?? 'linux';
  const isWayland = sessionType === 'wayland';
  const hasUnregisteredShortcut = KEYBOARD_SHORTCUT_DEFINITIONS.some(
    ({ id }) => registration[id] === false,
  );

  const applyShortcutsState = useCallback((state: KeyboardShortcutsState) => {
    setShortcuts(mergeShortcutsState(state));
    setRegistration(state.registration);
    setSessionType(state.sessionType);
  }, []);

  const loadShortcuts = useCallback(async () => {
    if (!window.electron) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const state = await window.electron.getKeyboardShortcutsState();
      applyShortcutsState(state);
    } catch {
      setError('Failed to load keyboard shortcuts.');
    } finally {
      setLoading(false);
    }
  }, [applyShortcutsState]);

  useEffect(() => {
    if (!open || !recordingId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setRecordingId(null);
        setError(null);
        return;
      }

      const accelerator = keyEventToAccelerator(event);
      if (!accelerator || !window.electron) {
        setError('Use a shortcut with at least one modifier key.');
        return;
      }

      void (async () => {
        try {
          const state = await window.electron!.setKeyboardShortcut(
            recordingId,
            accelerator,
          );
          applyShortcutsState(state);
          setRecordingId(null);
          setError(null);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to update keyboard shortcut.';
          setError(message);
        }
      })();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [applyShortcutsState, open, recordingId]);

  const handleClose = useCallback(() => {
    if (recordingId) {
      setRecordingId(null);
      setError(null);
      return;
    }

    setRecordingId(null);
    setError(null);
    onClose();
  }, [onClose, recordingId]);

  const handleDialogEntered = useCallback(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  const handleReset = useCallback(
    async (id: KeyboardShortcutId) => {
      if (!window.electron) {
        return;
      }

      setError(null);

      try {
        const state = await window.electron.setKeyboardShortcut(
          id,
          DEFAULT_KEYBOARD_SHORTCUTS[id],
        );
        applyShortcutsState(state);
        setRecordingId(null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to reset keyboard shortcut.';
        setError(message);
      }
    },
    [applyShortcutsState],
  );

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        transition: {
          onEntered: handleDialogEntered,
        },
      }}
    >
      <DialogTitle>Keyboard shortcuts</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Global shortcuts work while Encrypt is running, even when the window
          is hidden.
        </Typography>
        {isWayland ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            You are on Wayland. Global shortcuts use the desktop portal and may
            require binding them in your system keyboard settings.
          </Alert>
        ) : null}
        {hasUnregisteredShortcut ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            One or more shortcuts could not be registered. Try a different key
            combination or check whether another app already uses it.
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {recordingId ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Press the new shortcut keys, or Esc to cancel.
          </Alert>
        ) : null}
        <List disablePadding>
          {KEYBOARD_SHORTCUT_DEFINITIONS.map(({ id, label }) => {
            const accelerator = shortcuts[id];
            const isRecording = recordingId === id;
            const isDefault = accelerator === DEFAULT_KEYBOARD_SHORTCUTS[id];
            const isRegistered = registration[id] !== false;
            const shortcutLabel = isRecording
              ? 'Listening for new shortcut...'
              : formatAcceleratorForDisplay(accelerator, platform);
            const statusSuffix =
              !isRecording && registration[id] === false
                ? ' (not registered)'
                : '';

            return (
              <ListItem
                key={id}
                disableGutters
                sx={{
                  alignItems: 'flex-start',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1,
                  py: 1.5,
                }}
              >
                <ListItemText
                  primary={label}
                  secondary={`${shortcutLabel}${statusSuffix}`}
                  sx={{ flex: 1, m: 0 }}
                  slotProps={{
                    secondary: {
                      sx: {
                        color: isRegistered ? 'text.secondary' : 'warning.main',
                      },
                    },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant={isRecording ? 'contained' : 'outlined'}
                    onClick={() => {
                      setError(null);
                      setRecordingId(isRecording ? null : id);
                    }}
                    disabled={loading}
                  >
                    {isRecording ? 'Cancel' : 'Change'}
                  </Button>
                  <Button
                    size="small"
                    onClick={() => void handleReset(id)}
                    disabled={loading || isDefault || isRecording}
                  >
                    Reset
                  </Button>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>
          {recordingId ? 'Cancel' : 'Close'}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
