import React, { useCallback, useState } from 'react';
import {
  Alert,
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
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { formatAuthPublicKeyWire } from '@encrypt/core/crypto/authProof';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
import { FeedLabSettingsMenu } from '@lab/components/FeedLabSettingsMenu.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

type FeedLabTab = 'feed' | 'users';

function tabFromPathname(pathname: string): FeedLabTab {
  return pathname.startsWith('/users') ? 'users' : 'feed';
}

function shortenMiddle(text: string, head = 12, tail = 8): string {
  if (text.length <= head + tail + 3) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

type CopyableChipProps = {
  label: string;
  copyText: string;
  title: string;
  onCopied: () => void;
  onCopyFailed: () => void;
};

function CopyableChip({
  label,
  copyText,
  title,
  onCopied,
  onCopyFailed,
}: CopyableChipProps) {
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(copyText).then(onCopied, onCopyFailed);
  }, [copyText, onCopied, onCopyFailed]);

  return (
    <Chip
      size="small"
      icon={<ContentCopyOutlinedIcon fontSize="small" />}
      label={label}
      title={title}
      onClick={handleCopy}
      sx={{ cursor: 'pointer' }}
    />
  );
}

export function FeedLabLayout() {
  const apiUrl = getApiBaseUrl();
  const { keys } = useFeedLabSession();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPathname(location.pathname);
  const publicKeyWire = keys.publicKey
    ? formatAuthPublicKeyWire(keys.publicKey)
    : null;
  const [copyNotice, setCopyNotice] = useState<{
    open: boolean;
    severity: 'success' | 'error';
    key: number;
  }>({ open: false, severity: 'success', key: 0 });

  const showCopySuccess = useCallback(() => {
    setCopyNotice((prev) => ({
      open: true,
      severity: 'success',
      key: prev.key + 1,
    }));
  }, []);

  const showCopyFailure = useCallback(() => {
    setCopyNotice((prev) => ({
      open: true,
      severity: 'error',
      key: prev.key + 1,
    }));
  }, []);

  const handleCopyNoticeClose = useCallback(() => {
    setCopyNotice((prev) => ({ ...prev, open: false }));
  }, []);

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
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 40,
              '& .MuiTab-root': { minHeight: 40, fontWeight: 600 },
            }}
          >
            <Tab label="Feed" value="feed" />
            <Tab label="Users" value="users" />
          </Tabs>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            size="small"
            variant="outlined"
            label={`API ${apiUrl}`}
            sx={{ borderColor: 'divider' }}
          />
          <FeedLabSettingsMenu />
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              keys.clearSessionError();
              void keys.changeKeyId();
            }}
          >
            {keys.keyId ? 'Change user' : 'Use private key to authenticate'}
          </Button>
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {keys.privateKeyFileName ? (
              <Chip
                size="small"
                label={`filename: ${keys.privateKeyFileName}`}
                title={keys.privateKeyFileName}
              />
            ) : null}
            {keys.keyId ? (
              <CopyableChip
                label={`keyId: ${shortenMiddle(keys.keyId)}`}
                copyText={keys.keyId}
                title="Click to copy keyId"
                onCopied={showCopySuccess}
                onCopyFailed={showCopyFailure}
              />
            ) : null}
            {publicKeyWire ? (
              <CopyableChip
                label={`publicKey: ${shortenMiddle(publicKeyWire, 10, 10)}`}
                copyText={publicKeyWire}
                title="Click to copy public key (x;y)"
                onCopied={showCopySuccess}
                onCopyFailed={showCopyFailure}
              />
            ) : null}
          </Stack>

          {keys.sessionError ? (
            <Alert severity="error" onClose={() => keys.clearSessionError()}>
              {keys.sessionError}
            </Alert>
          ) : null}

          <Outlet />
        </Stack>
      </Container>

      <CopiedToClipboardSnackbar
        open={copyNotice.open}
        severity={copyNotice.severity}
        snackbarKey={copyNotice.key}
        onClose={handleCopyNoticeClose}
      />
    </Box>
  );
}
