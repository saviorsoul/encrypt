import React from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
import { shortPrivateKeyFileName } from '@lab/lib/shortPrivateKeyFileName.ts';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

type FeedLabTab = 'feed' | 'users';

function tabFromPathname(pathname: string): FeedLabTab {
  return pathname.startsWith('/users') ? 'users' : 'feed';
}

export function FeedLabLayout() {
  const apiUrl = getApiBaseUrl();
  const { keys } = useFeedLabSession();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPathname(location.pathname);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ mr: 1 }}>
            Feed Lab
          </Typography>
          <Tabs
            value={activeTab}
            onChange={(_, value: FeedLabTab) => {
              navigate(value === 'feed' ? '/feed' : '/users');
            }}
            textColor="inherit"
            indicatorColor="secondary"
          >
            <Tab label="Feed" value="feed" />
            <Tab label="Users" value="users" />
          </Tabs>
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" label={`API ${apiUrl}`} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {keys.keyId ? (
              <Chip
                size="small"
                label={`keyId ${keys.keyId.slice(0, 12)}...`}
              />
            ) : null}
            {keys.privateKeyFileName ? (
              <Chip
                size="small"
                label={`key ${shortPrivateKeyFileName(keys.privateKeyFileName)}`}
              />
            ) : null}
            <Button size="small" onClick={() => void keys.changeKeyId()}>
              {keys.keyId ? 'Change your keyId' : 'Set your keyId'}
            </Button>
          </Stack>

          <Outlet />
        </Stack>
      </Container>
    </Box>
  );
}
