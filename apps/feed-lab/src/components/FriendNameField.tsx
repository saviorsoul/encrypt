import React, { useState } from 'react';
import { Typography } from '@mui/material';
import { FriendNameInput } from '@lab/components/FriendNameInput.tsx';

type FriendNameFieldProps = {
  friendKeyId: string;
  label: string;
  storedUsername?: string;
  publicKey: { x: string; y: string };
  ownerKeyId: string;
  existingUsernames: string[];
  disabled?: boolean;
  onSaved: (input: { keyId: string; username: string }) => void;
};

export function FriendNameField({
  friendKeyId,
  label,
  storedUsername,
  publicKey,
  ownerKeyId,
  existingUsernames,
  disabled = false,
  onSaved,
}: FriendNameFieldProps) {
  const [editing, setEditing] = useState(!storedUsername);

  if (!storedUsername || editing) {
    return (
      <FriendNameInput
        friendKeyId={friendKeyId}
        publicKey={publicKey}
        ownerKeyId={ownerKeyId}
        existingUsernames={existingUsernames}
        currentUsername={storedUsername ?? ''}
        initialValue={storedUsername ?? ''}
        autoFocus={Boolean(storedUsername)}
        disabled={disabled}
        onSaved={onSaved}
        onEditEnd={() => {
          if (storedUsername) {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <Typography
      variant="body2"
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) {
          setEditing(true);
        }
      }}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setEditing(true);
        }
      }}
      sx={{
        cursor: disabled ? 'default' : 'pointer',
        width: 'fit-content',
        maxWidth: 320,
        borderRadius: 0.5,
        '&:hover': disabled
          ? undefined
          : {
              backgroundColor: 'action.hover',
            },
        '&:focus-visible': {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      {storedUsername ?? label}
    </Typography>
  );
}
