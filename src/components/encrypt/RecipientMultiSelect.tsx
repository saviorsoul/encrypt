import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import { MOCK_RECIPIENTS_SELECTION } from '@/constants/mockRecipients.ts';

type RecipientMultiSelectProps = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  getOptionLabel?: (option: string) => string;
  disabled?: boolean;
};

export function RecipientMultiSelect({
  options,
  value,
  onChange,
  getOptionLabel,
  disabled = false,
}: RecipientMultiSelectProps) {
  const resolveLabel = getOptionLabel ?? ((option: string) => option);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      disableClearable
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      disabled={disabled}
      getOptionLabel={resolveLabel}
      renderValue={(selected, getTagProps) => {
        const chips: React.ReactNode[] = [];
        const mockIndex = selected.indexOf(MOCK_RECIPIENTS_SELECTION);
        const selectedUsers = selected.filter(
          (option) => option !== MOCK_RECIPIENTS_SELECTION,
        );

        if (mockIndex >= 0) {
          const { key, ...tagProps } = getTagProps({ index: mockIndex });
          chips.push(
            <Chip
              key={key}
              label={resolveLabel(MOCK_RECIPIENTS_SELECTION)}
              size="small"
              {...tagProps}
            />,
          );
        }

        if (selectedUsers.length > 0) {
          const tagIndex = mockIndex >= 0 ? mockIndex + 1 : 0;
          const { key, ...tagProps } = getTagProps({ index: tagIndex });
          chips.push(
            <Chip
              key={`selected-users-${key}`}
              label={`Selected users (${selectedUsers.length})`}
              size="small"
              {...tagProps}
              onDelete={() => {
                onChange(
                  selected.filter(
                    (option) => option === MOCK_RECIPIENTS_SELECTION,
                  ),
                );
              }}
            />,
          );
        }

        return chips;
      }}
      size="small"
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={
            value.length === 0 ? 'Select users to encrypt for…' : undefined
          }
        />
      )}
      sx={{ minWidth: 280, flex: 1 }}
    />
  );
}
