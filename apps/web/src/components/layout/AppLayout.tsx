import React, { useCallback, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Outlet,
  useNavigate,
  Link as RouterLink,
  useLocation,
} from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { formatEcPublicKeyText } from '@/crypto/ecPublicKey.ts';
import { nameInitial } from '@/utils/nameInitial.ts';
import { CleanDataDialog } from '@/components/shared/CleanDataDialog.tsx';
import { PublicKeyDialog } from '@/components/shared/PublicKeyDialog.tsx';
import { clearAppLocalData } from '@/utils/clearAppLocalData';
import { ProofOfConceptsNav } from '@/components/layout/ProofOfConceptsNav.tsx';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer.tsx';
import { SessionPrivateKeyNavSwitch } from '@/components/layout/SessionPrivateKeyNavSwitch.tsx';

const NAV_ITEMS = [
  { label: '1:1', to: '/' },
  { label: 'Feed', to: '/feed' },
  { label: 'Glossary', to: '/glossary' },
];

const EXISTING_USER_LOGIN_SNACKBAR_MS = 5000;

export function AppLayout() {
  const { user, logout, loginNotice, clearLoginNotice } = useAuth();
  const { publicKeyJwk } = useKeysContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [publicKeyDialogOpen, setPublicKeyDialogOpen] = useState(false);
  const [cleanDataDialogOpen, setCleandataDialogOpen] = useState(false);

  const publicKeyJwkText = useMemo(
    () => (publicKeyJwk ? formatEcPublicKeyText(publicKeyJwk) : ''),
    [publicKeyJwk],
  );

  const handleCloseMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleCleandata = useCallback(async () => {
    logout();
    await clearAppLocalData();
    setCleandataDialogOpen(false);
    navigate('/login', { replace: true });
  }, [logout, navigate]);

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
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
                <Box
                  sx={{ flexGrow: 1, display: { xs: 'block', md: 'none' } }}
                />
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SessionPrivateKeyNavSwitch />
                <Tooltip title="Clean local data">
                  <span>
                    <IconButton
                      color="inherit"
                      aria-label="Clean local data"
                      onClick={() => setCleandataDialogOpen(true)}
                      size="small"
                    >
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Show public key">
                  <span>
                    <IconButton
                      color="inherit"
                      aria-label="Show public key"
                      onClick={() => setPublicKeyDialogOpen(true)}
                      size="small"
                    >
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
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
      {user ? (
        <>
          <PublicKeyDialog
            open={publicKeyDialogOpen}
            onClose={() => setPublicKeyDialogOpen(false)}
            title={`${user.username} - public key`}
            publicKeyJwkText={publicKeyJwkText}
          />
          <CleanDataDialog
            open={cleanDataDialogOpen}
            onClose={() => setCleandataDialogOpen(false)}
            onConfirm={handleCleandata}
          />
        </>
      ) : null}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
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
