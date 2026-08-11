import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Container,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { UsersPage } from '@feednt/pages/UsersPage.tsx';
import { useFeedntFriendships } from '@feednt/providers/FeedntFriendshipsProvider.tsx';

type UsersDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function UsersDrawer({ open, onClose }: UsersDrawerProps) {
  const { ensureUsersLoaded, refresh, usersLoading } = useFeedntFriendships();
  const [hasOpened, setHasOpened] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  const handleRefresh = useCallback(() => {
    void refresh({ force: true });
  }, [refresh]);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setHasOpened(true);
    }
  }

  useEffect(() => {
    if (open) {
      void ensureUsersLoaded();
    }
  }, [ensureUsersLoaded, open]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: (theme) => ({
            left: 0,
            right: 0,
            mx: 'auto',
            width: '100%',
            maxWidth: theme.breakpoints.values.sm,
            maxHeight: '85vh',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }),
        },
      }}
    >
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="h6">Users</Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <IconButton
                aria-label="Refresh users"
                onClick={handleRefresh}
                disabled={!open || usersLoading}
                edge="end"
              >
                {usersLoading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshOutlinedIcon />
                )}
              </IconButton>
              <IconButton aria-label="Close users" onClick={onClose} edge="end">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
          <Box sx={{ overflow: 'auto' }}>
            {hasOpened ? <UsersPage /> : null}
          </Box>
        </Stack>
      </Container>
    </Drawer>
  );
}
