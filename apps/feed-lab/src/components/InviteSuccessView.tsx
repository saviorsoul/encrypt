import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { useCopiedToClipboardSnackbar } from '@encrypt/ui/useCopiedToClipboardSnackbar';

type InviteSuccessViewProps = {
  inviterName: string;
  publicKeyText: string;
  variant?: 'accepted' | 'alreadyFriends';
  onOpenFeed: () => void;
};

export function InviteSuccessView({
  inviterName,
  publicKeyText,
  variant = 'accepted',
  onOpenFeed,
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
            : `You are now friends with ${inviterName}. This invitation is closed and cannot be used again.`}
        </Alert>
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ width: '100%' }}
        >
          Copy your public key below if you want to share it with someone.
        </Typography>
        <TextField
          label="Your public key"
          value={publicKeyText}
          fullWidth
          multiline
          minRows={2}
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
            <Button
              data-testid="invite-open-feed"
              variant="outlined"
              fullWidth
              onClick={onOpenFeed}
            >
              Open feed
            </Button>
          </Stack>
        </Box>
      </Stack>
      <CopiedToClipboardSnackbar {...snackbarProps} />
    </Paper>
  );
}
