import React, { useCallback } from 'react';
import { AppBar, Box, Container, Stack } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FeedLabTopNav } from '@lab/components/FeedLabTopNav.tsx';
import { PrivateKeyAuthDialog } from '@lab/components/PrivateKeyAuthDialog.tsx';
import { UsersDrawer } from '@lab/components/UsersDrawer.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

function usersDrawerOpenFromPathname(pathname: string): boolean {
  return pathname.startsWith('/users');
}

export function FeedLabLayout() {
  const { keys } = useFeedLabSession();
  const location = useLocation();
  const navigate = useNavigate();
  const usersDrawerOpen = usersDrawerOpenFromPathname(location.pathname);
  const authDialogOpen = keys.keyId == null;

  const handleUsersNav = useCallback(() => {
    navigate(usersDrawerOpen ? '/feed' : '/users');
  }, [navigate, usersDrawerOpen]);

  const closeUsersDrawer = useCallback(() => {
    navigate('/feed');
  }, [navigate]);

  const handleAuthenticate = useCallback(async () => {
    return keys.changeKeyId();
  }, [keys]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky">
        <FeedLabTopNav
          usersActive={usersDrawerOpen}
          onOpenUsers={handleUsersNav}
        />
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Outlet />
        </Stack>
      </Container>

      <UsersDrawer open={usersDrawerOpen} onClose={closeUsersDrawer} />

      <PrivateKeyAuthDialog
        open={authDialogOpen}
        sessionError={keys.sessionError}
        onAuthenticate={handleAuthenticate}
        onClearError={keys.clearSessionError}
      />
    </Box>
  );
}
