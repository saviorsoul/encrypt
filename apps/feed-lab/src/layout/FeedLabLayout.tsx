import React, { useCallback } from 'react';
import { AppBar, Box, Container, Stack } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FeedLabTopNav } from '@lab/components/FeedLabTopNav.tsx';
import { UsersDrawer } from '@lab/components/UsersDrawer.tsx';

function usersDrawerOpenFromPathname(pathname: string): boolean {
  return pathname.startsWith('/users');
}

export function FeedLabLayout() {
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
    </Box>
  );
}
