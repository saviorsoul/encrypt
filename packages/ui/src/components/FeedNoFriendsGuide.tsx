import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

export type FeedNoFriendsGuideProps = {
  loading: boolean;
  error: string | null;
  onAcceptInvite?: () => void;
  acceptInviteDisabled?: boolean;
};

export function FeedNoFriendsGuide({
  loading,
  error,
  onAcceptInvite,
  acceptInviteDisabled = false,
}: FeedNoFriendsGuideProps) {
  if (loading) {
    return (
      <Box
        data-testid="feed-no-friends-guide-loading"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
      >
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Checking your friends network…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert data-testid="feed-no-friends-guide-error" severity="warning">
        Could not load your friends network. Try refreshing the feed or opening
        Users.
      </Alert>
    );
  }

  return (
    <Paper
      data-testid="feed-no-friends-guide-not-registered"
      sx={{ p: 2 }}
      elevation={1}
    >
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">No friends yet</Typography>
        <Typography variant="body2" color="text.secondary">
          You need at least one friend before you can create messages or share
          with your network. Ask someone already on the network to send you an
          invitation ID.
        </Typography>
        {onAcceptInvite ? (
          <Box>
            <Button
              data-testid="feed-accept-invitation"
              variant="outlined"
              size="small"
              disabled={acceptInviteDisabled}
              onClick={onAcceptInvite}
            >
              Accept invite
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
