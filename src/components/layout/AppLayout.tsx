import React, { useCallback, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import {
  Outlet,
  useNavigate,
  Link as RouterLink,
  useLocation,
} from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { nameInitial } from '@/utils/nameInitial.ts';
import { ProofOfConceptsNav } from '@/components/layout/ProofOfConceptsNav.tsx';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer.tsx';

const NAV_ITEMS = [
  { label: '1:1', to: '/' },
  { label: 'Feed', to: '/feed' },
  { label: 'Glossary', to: '/glossary' },
];

const EXISTING_USER_LOGIN_SNACKBAR_MS = 5000;

export function AppLayout() {
  const { user, logout, loginNotice, clearLoginNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleCloseMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isNavActive = (to: string) =>
    to === '/'
      ? location.pathname === '/' || location.pathname === '/1-1'
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  const isFullscreenAuthPage =
    location.pathname === '/login' || location.pathname === '/save-private-key';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!isFullscreenAuthPage ? (
        <AppBar position="sticky">
          <Toolbar>
            {user ? (
              <>
                <IconButton
                  color="inherit"
                  aria-label="Open menu"
                  edge="start"
                  onClick={() => setMobileNavOpen(true)}
                  sx={{ display: { xs: 'inline-flex', sm: 'none' }, mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
                <Box
                  sx={{ flexGrow: 1, display: { xs: 'block', sm: 'none' } }}
                />
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    gap: 0.5,
                    flexGrow: 1,
                    alignItems: 'center',
                  }}
                >
                  {NAV_ITEMS.map(({ label, to }) => (
                    <Button
                      key={to}
                      color="inherit"
                      component={RouterLink}
                      to={to}
                      sx={{
                        opacity: isNavActive(to) ? 1 : 0.7,
                        fontWeight: isNavActive(to) ? 600 : 400,
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                  <ProofOfConceptsNav />
                </Box>
              </>
            ) : (
              <Box sx={{ flexGrow: 1 }} />
            )}
            {user ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2">{user.username}</Typography>
                <Avatar sx={{ width: 34, height: 34 }}>
                  {nameInitial(user.username)}
                </Avatar>
                <IconButton
                  color="inherit"
                  onClick={handleLogout}
                  aria-label="Log out"
                  edge="end"
                  size="small"
                >
                  <LogoutIcon />
                </IconButton>
              </Box>
            ) : location.pathname !== '/login' ? (
              <Button color="inherit" component={RouterLink} to="/login">
                Sign in
              </Button>
            ) : null}
          </Toolbar>
        </AppBar>
      ) : null}
      {user && !isFullscreenAuthPage ? (
        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={handleCloseMobileNav}
          navItems={NAV_ITEMS}
          isNavActive={isNavActive}
        />
      ) : null}
      <Box
        component="main"
        sx={{
          flex: 1,
          ...(isFullscreenAuthPage ? {} : { px: { xs: 1, sm: 2 }, py: 2 }),
        }}
      >
        <Outlet />
      </Box>
      <Snackbar
        open={Boolean(loginNotice)}
        autoHideDuration={EXISTING_USER_LOGIN_SNACKBAR_MS}
        onClose={clearLoginNotice}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={clearLoginNotice}
          sx={{ width: '100%' }}
        >
          {loginNotice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
