import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import DownloadIcon from '@mui/icons-material/Download';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { useExternalFileContext } from '@/components/providers/ExternalFileProvider.tsx';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { usePrivateKeyOnboardingGuard } from '@/hooks/usePrivateKeyOnboardingGuard.ts';
import { getImportDestinationRoute } from '@/utils/importDestination.ts';
import { NotFoundPage } from '@/pages/NotFoundPage.tsx';
import Stack from '@mui/material/Stack';

export function PrivateKeyDownloadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pendingImport } = useExternalFileContext();
  const onboardingStatus = usePrivateKeyOnboardingGuard();
  const {
    loading,
    privateKeySaved,
    pendingPrivateKeyJwk,
    ensurePendingPrivateKey,
    downloadPendingPrivateKey,
  } = useKeysContext();
  const [downloading, setDownloading] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [prevPrivateKeySaved, setPrevPrivateKeySaved] =
    useState(privateKeySaved);

  if (privateKeySaved !== prevPrivateKeySaved) {
    setPrevPrivateKeySaved(privateKeySaved);
    if (!privateKeySaved) {
      setShowNext(false);
    }
  }

  useEffect(() => {
    if (!privateKeySaved) {
      return;
    }

    const timer = window.setTimeout(() => setShowNext(true), 300);
    return () => window.clearTimeout(timer);
  }, [privateKeySaved]);

  useEffect(() => {
    if (onboardingStatus !== 'required') return;
    if (loading || pendingPrivateKeyJwk || privateKeySaved) return;
    void ensurePendingPrivateKey();
  }, [
    onboardingStatus,
    loading,
    pendingPrivateKeyJwk,
    privateKeySaved,
    ensurePendingPrivateKey,
  ]);

  const postOnboardingRoute = pendingImport
    ? getImportDestinationRoute(pendingImport.destination)
    : '/';

  if (!user) return <Navigate to="/login" replace />;
  if (onboardingStatus === 'complete') {
    return <Navigate to={postOnboardingRoute} replace />;
  }
  if (onboardingStatus === 'loading') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress aria-label="Checking onboarding status" />
      </Box>
    );
  }
  if (onboardingStatus === 'error') {
    return (
      <NotFoundPage
        code="Error"
        title="Something went wrong"
        message="We could not load your account data. Check your connection, refresh the page, or sign in again."
        actionLabel="Refresh page"
        onAction={() => window.location.reload()}
      />
    );
  }
  if (onboardingStatus === 'recovery') {
    return <Navigate to="/recover-local-data" replace />;
  }
  const handleDownload = async () => {
    if (!pendingPrivateKeyJwk) return;
    setDownloading(true);
    try {
      await downloadPendingPrivateKey();
    } finally {
      setDownloading(false);
    }
  };

  const handleNext = () => {
    navigate(postOnboardingRoute, { replace: true });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        px: 2,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 480, width: '100%' }} elevation={2}>
        <Stack direction="column" spacing={3} sx={{ mb: 3 }}>
          <Typography
            variant="h5"
            gutterBottom
            align="center"
            sx={{ fontFamily: 'monospace' }}
          >
            Save your private key
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontFamily: 'monospace' }}
          >
            {user.username}, this is your only chance to save your private key.
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontFamily: 'monospace' }}
          >
            Download the key file before continuing. The app cannot recover it
            later.
          </Typography>
        </Stack>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {privateKeySaved && showNext ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={handleNext}
            >
              NEXT
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={() => void handleDownload()}
              disabled={
                loading ||
                downloading ||
                privateKeySaved ||
                !pendingPrivateKeyJwk
              }
            >
              {loading
                ? 'Preparing your keys…'
                : downloading || privateKeySaved
                  ? 'Downloading…'
                  : 'Download private key'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
