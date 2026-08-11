import { useCallback } from 'react';
import { AppBar, Box, Container, Stack } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FeedntTopNav } from '@feednt/components/FeedntTopNav.tsx';
import { UsersDrawer } from '@feednt/components/UsersDrawer.tsx';
import { FeedntFriendshipsProvider } from '@feednt/providers/FeedntFriendshipsProvider.tsx';

function usersDrawerOpenFromPathname(pathname: string): boolean {
  return pathname.startsWith('/users');
}

export function FeedntLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const usersDrawerOpen = usersDrawerOpenFromPathname(location.pathname);

  const handleUsersNav = useCallback(() => {
    navigate(usersDrawerOpen ? '/feed' : '/users');
  }, [navigate, usersDrawerOpen]);

  const closeUsersDrawer = useCallback(() => {
    navigate('/feed');
  }, [navigate]);

  return (
    <FeedntFriendshipsProvider>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky">
          <FeedntTopNav
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
      </Box>
    </FeedntFriendshipsProvider>
  );
}
