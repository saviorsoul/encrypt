import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';

export type KeyIdMultiSelectProps = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  getOptionLabel?: (option: string) => string;
  disabled?: boolean;
  onOpen?: () => void;
  placeholder?: string;
};

export function KeyIdMultiSelect({
  options,
  value,
  onChange,
  getOptionLabel,
  disabled = false,
  onOpen,
  placeholder = 'Select recipients…',
}: KeyIdMultiSelectProps) {
  const resolveLabel = getOptionLabel ?? ((option: string) => option);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      disableClearable
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      onOpen={onOpen}
      disabled={disabled}
      getOptionLabel={resolveLabel}
      renderValue={(selected, getTagProps) =>
        selected.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              label={resolveLabel(option)}
              size="small"
              {...tagProps}
            />
          );
        })
      }
      size="small"
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={value.length === 0 ? placeholder : undefined}
        />
      )}
      sx={{ minWidth: 280, flex: 1 }}
    />
  );
}
