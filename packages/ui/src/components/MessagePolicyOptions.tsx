import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';

export const MESSAGE_POLICY_OPTIONS_REVEAL_MS = 300;

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
    <Stack spacing={1.5} sx={{ pt: 2 }}>
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

export type MessagePolicyOptionsRevealProps = {
  loading: boolean;
  hasFriends: boolean;
  noFriendsMessage: string;
  mode: MessagePolicyOptionsProps['mode'];
};

export function MessagePolicyOptionsReveal({
  loading,
  hasFriends,
  noFriendsMessage,
  mode,
}: MessagePolicyOptionsRevealProps) {
  const showPolicyOptions = !loading && hasFriends;

  return (
    <Box sx={{ width: '100%' }}>
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading recipients…
          </Typography>
        </Box>
      ) : null}

      {showPolicyOptions ? (
        <Collapse
          in
          appear
          timeout={MESSAGE_POLICY_OPTIONS_REVEAL_MS}
          sx={{ m: 0 }}
        >
          <MessagePolicyOptions mode={mode} />
        </Collapse>
      ) : null}

      {!loading && !hasFriends ? (
        <Typography variant="body2" color="text.secondary">
          {noFriendsMessage}
        </Typography>
      ) : null}
    </Box>
  );
}
