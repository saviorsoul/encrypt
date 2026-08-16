import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

export const MESSAGE_VISIBILITY_POLICY = {
  title: 'Visibility',
  value: 'All friends',
} as const;

export const MESSAGE_SHAREABILITY_POLICY = {
  title: 'Shareability',
  value: 'Everyone',
} as const;

type MessagePolicyFieldProps = {
  title: string;
  value: string;
};

function MessagePolicyField({ title, value }: MessagePolicyFieldProps) {
  return (
    <TextField
      select
      size="small"
      label={title}
      value={value}
      fullWidth
      disabled
      slotProps={{
        select: {
          IconComponent: () => null,
        },
        input: { readOnly: true },
      }}
      sx={{
        '& .MuiSelect-select': {
          fontSize: (theme) => theme.typography.body2.fontSize,
          lineHeight: (theme) => theme.typography.body2.lineHeight,
        },
        '& .MuiSelect-select.Mui-disabled': {
          WebkitTextFillColor: (theme) => theme.palette.text.primary,
          color: (theme) => theme.palette.text.primary,
        },
        '& .MuiInputLabel-root.Mui-disabled': {
          color: (theme) => theme.palette.text.secondary,
        },
      }}
    >
      <MenuItem value={value}>{value}</MenuItem>
    </TextField>
  );
}

export type MessagePolicyOptionsProps = {
  mode: 'create' | 'share';
};

export function MessagePolicyOptions({ mode }: MessagePolicyOptionsProps) {
  return (
    <Stack spacing={1.5}>
      <MessagePolicyField
        title={MESSAGE_VISIBILITY_POLICY.title}
        value={MESSAGE_VISIBILITY_POLICY.value}
      />
      {mode === 'create' ? (
        <MessagePolicyField
          title={MESSAGE_SHAREABILITY_POLICY.title}
          value={MESSAGE_SHAREABILITY_POLICY.value}
        />
      ) : null}
    </Stack>
  );
}
