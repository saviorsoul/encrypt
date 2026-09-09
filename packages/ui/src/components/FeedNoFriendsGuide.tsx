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
  invitationalOnly?: boolean;
  onAcceptInvite?: () => void;
  acceptInviteDisabled?: boolean;
  onInviteFriend?: () => void;
  inviteFriendDisabled?: boolean;
};

export function FeedNoFriendsGuide({
  loading,
  error,
  invitationalOnly = true,
  onAcceptInvite,
  acceptInviteDisabled = false,
  onInviteFriend,
  inviteFriendDisabled = false,
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

  const showAcceptInvite = onAcceptInvite != null;
  const showInviteFriend = !invitationalOnly && onInviteFriend != null;

  return (
    <Paper
      data-testid={
        invitationalOnly
          ? 'feed-no-friends-guide-not-registered'
          : 'feed-no-friends-guide-no-friends'
      }
      sx={{ p: 2 }}
      elevation={1}
    >
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">No friends yet</Typography>
        <Typography variant="body2" color="text.secondary">
          {invitationalOnly
            ? 'You need at least one friend before you can create messages or share with your network. Ask someone already on the network to send you an invitation ID.'
            : 'Ask someone to send you an invitation, or add friends from the Users page to start messaging and sharing with your network.'}
        </Typography>
        {showAcceptInvite || showInviteFriend ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            {showAcceptInvite ? (
              <Button
                data-testid="feed-accept-invitation"
                variant="outlined"
                size="small"
                disabled={acceptInviteDisabled}
                onClick={onAcceptInvite}
              >
                Enter code
              </Button>
            ) : null}
            {showInviteFriend ? (
              <Button
                data-testid="feed-invite-friend"
                variant="outlined"
                size="small"
                disabled={inviteFriendDisabled}
                onClick={onInviteFriend}
              >
                Invite friend
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
