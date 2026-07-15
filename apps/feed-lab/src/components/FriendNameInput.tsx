import React, { useCallback, useRef, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import { Box, IconButton, InputAdornment, TextField } from '@mui/material';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';

type FriendNameInputProps = {
  friendKeyId: string;
  publicKey: { x: string; y: string };
  ownerKeyId: string;
  existingUsernames: string[];
  currentUsername?: string;
  initialValue?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onSaved: (input: { keyId: string; username: string }) => void;
  onEditEnd?: () => void;
};

export function FriendNameInput({
  friendKeyId,
  publicKey,
  ownerKeyId,
  existingUsernames,
  currentUsername = '',
  initialValue = '',
  autoFocus = false,
  disabled = false,
  onSaved,
  onEditEnd,
}: FriendNameInputProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const nameExists =
    trimmed.length > 0 &&
    existingUsernames.some(
      (existing) =>
        existing.localeCompare(trimmed, undefined, {
          sensitivity: 'accent',
        }) === 0,
    ) &&
    trimmed.localeCompare(currentUsername, undefined, {
      sensitivity: 'accent',
    }) !== 0;
  const unchanged =
    currentUsername.length > 0 &&
    trimmed.localeCompare(currentUsername, undefined, {
      sensitivity: 'accent',
    }) === 0;
  const duplicateError = nameExists
    ? `"${trimmed}" already exists. Choose a unique name.`
    : null;
  const displayError = duplicateError ?? error;
  const canSave =
    trimmed.length > 0 && !nameExists && !unchanged && !busy && !disabled;

  const save = useCallback(async () => {
    if (!canSave) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveFeedLabUser(ownerKeyId, trimmed, {
        kty: 'EC',
        crv: 'P-256',
        x: publicKey.x,
        y: publicKey.y,
      });
      onSaved({ keyId: friendKeyId, username: trimmed });
      onEditEnd?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save name.');
    } finally {
      setBusy(false);
    }
  }, [
    canSave,
    friendKeyId,
    onSaved,
    ownerKeyId,
    publicKey.x,
    publicKey.y,
    trimmed,
    onEditEnd,
  ]);

  const rootRef = useRef<HTMLDivElement>(null);

  const handleFocusOut = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (busy) {
        return;
      }

      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) {
        return;
      }

      onEditEnd?.();
    },
    [busy, onEditEnd],
  );

  const handleConfirmKeyDown = useCallback(
    (event: React.KeyboardEvent, allowSpace = false) => {
      if (!canSave) {
        return;
      }

      if (event.key === 'Enter' || (allowSpace && event.key === ' ')) {
        event.preventDefault();
        void save();
      }
    },
    [canSave, save],
  );

  return (
    <Box
      ref={rootRef}
      onBlur={handleFocusOut}
      sx={{ maxWidth: 320, width: '100%' }}
    >
      <TextField
        variant="filled"
        size="small"
        placeholder="Add name"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          handleConfirmKeyDown(event);
        }}
        disabled={disabled || busy}
        error={Boolean(displayError)}
        fullWidth
        sx={{
          '& .MuiFilledInput-root': {
            fontSize: (theme) => theme.typography.body2.fontSize,
            lineHeight: (theme) => theme.typography.body2.lineHeight,
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'transparent',
            },
            '&.Mui-focused': {
              backgroundColor: 'transparent',
            },
          },
        }}
        slotProps={{
          input: {
            endAdornment:
              value.length > 0 ? (
                <InputAdornment position="end" sx={{ ml: 0.5 }}>
                  <IconButton
                    edge="end"
                    type="button"
                    disabled={!canSave}
                    aria-label="Confirm name"
                    tabIndex={canSave ? 0 : -1}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      void save();
                    }}
                    onKeyDown={(event) => {
                      handleConfirmKeyDown(event, true);
                    }}
                    sx={{
                      p: 0,
                      color: 'text.disabled',
                      cursor: canSave ? 'pointer' : 'not-allowed',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    }}
                  >
                    <CheckIcon sx={{ fontSize: '0.75em' }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
          },
          htmlInput: {
            sx: {
              padding: 0,
            },
          },
        }}
      />
    </Box>
  );
}
