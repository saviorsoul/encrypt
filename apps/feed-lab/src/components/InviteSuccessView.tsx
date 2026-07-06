import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';

type InviteSuccessViewProps = {
  inviterName: string;
  publicKeyText: string;
  publicKeyFormat: 'xy' | 'json';
  variant?: 'accepted' | 'alreadyFriends';
  onPublicKeyFormatChange: (format: 'xy' | 'json') => void;
  onOpenFeed: () => void;
  onOpenUsers: () => void;
};

export function InviteSuccessView({
  inviterName,
  publicKeyText,
  publicKeyFormat,
  variant = 'accepted',
  onPublicKeyFormatChange,
  onOpenFeed,
  onOpenUsers,
}: InviteSuccessViewProps) {
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const handleCopyPublicKey = () => {
    if (!publicKeyText) return;
    void copyAndNotify(publicKeyText);
  };

  const isAlreadyFriends = variant === 'alreadyFriends';

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        {isAlreadyFriends ? (
          <InfoOutlinedIcon color="info" sx={{ fontSize: 56 }} />
        ) : (
          <CheckCircleOutlinedIcon color="success" sx={{ fontSize: 56 }} />
        )}
        <Typography variant="h5" align="center">
          {isAlreadyFriends ? 'Already friends' : 'Invitation accepted'}
        </Typography>
        <Alert
          severity={isAlreadyFriends ? 'info' : 'success'}
          sx={{ width: '100%' }}
        >
          {isAlreadyFriends
            ? `You are already friends with ${inviterName}.`
            : `You are now friends with ${inviterName}. This invitation link is closed and cannot be used again.`}
        </Alert>
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ width: '100%' }}
        >
          Copy your public key below if you want to share it with someone.
        </Typography>
        <ToggleButtonGroup
          value={publicKeyFormat}
          exclusive
          onChange={(_, next: 'xy' | 'json' | null) => {
            if (next) {
              onPublicKeyFormatChange(next);
            }
          }}
          size="small"
        >
          <ToggleButton value="xy">x;y</ToggleButton>
          <ToggleButton value="json">JSON</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          label="Your public key"
          value={publicKeyText}
          fullWidth
          multiline
          minRows={publicKeyFormat === 'json' ? 6 : 2}
          onClick={handleCopyPublicKey}
          slotProps={{
            input: {
              readOnly: true,
              sx: {
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                cursor: publicKeyText ? 'pointer' : 'default',
              },
            },
          }}
        />
        <Box sx={{ width: '100%' }}>
          <Stack spacing={1}>
            <Button
              variant="outlined"
              fullWidth
              disabled={!publicKeyText}
              onClick={handleCopyPublicKey}
            >
              Copy public key
            </Button>
            <Button variant="outlined" fullWidth onClick={onOpenFeed}>
              Open feed
            </Button>
            <Button variant="outlined" fullWidth onClick={onOpenUsers}>
              Go to users
            </Button>
          </Stack>
        </Box>
      </Stack>
      <CopiedToClipboardSnackbar {...snackbarProps} />
    </Paper>
  );
}
