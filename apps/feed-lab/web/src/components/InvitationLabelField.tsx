import React, { useCallback, useState } from 'react';
import { Typography } from '@mui/material';
import { LocalNameInput } from '@lab/components/LocalNameInput.tsx';
import { saveSentInvitation } from '@lab/services/db/sentInvitations.ts';

type InvitationLabelFieldProps = {
  token: string;
  ownerKeyId: string;
  storedLabel?: string | null;
  existingNames: string[];
  disabled?: boolean;
  onSaved: (label: string) => void;
};

export function InvitationLabelField({
  token,
  ownerKeyId,
  storedLabel,
  existingNames,
  disabled = false,
  onSaved,
}: InvitationLabelFieldProps) {
  const label = storedLabel?.trim() || '';
  const [editing, setEditing] = useState(!label);
  const [hadLabel, setHadLabel] = useState(Boolean(label));

  if (Boolean(label) !== hadLabel) {
    setHadLabel(Boolean(label));
    if (label) {
      setEditing(false);
    }
  }

  const handleSave = useCallback(
    async (name: string) => {
      await saveSentInvitation(token, name, ownerKeyId);
      onSaved(name);
    },
    [onSaved, ownerKeyId, token],
  );

  if (!label || editing) {
    return (
      <LocalNameInput
        existingNames={existingNames}
        currentName={label}
        initialValue={label}
        autoFocus={Boolean(label)}
        disabled={disabled}
        onSave={handleSave}
        onEditEnd={() => {
          if (label) {
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
      {label}
    </Typography>
  );
}
