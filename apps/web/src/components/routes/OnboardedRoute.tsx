import React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { usePrivateKeyOnboardingGuard } from '@/hooks/usePrivateKeyOnboardingGuard.ts';
import { NotFoundPage } from '@/pages/NotFoundPage.tsx';

export function OnboardedRoute() {
  const { user } = useAuth();
  const onboardingStatus = usePrivateKeyOnboardingGuard();

  if (!user) return <Navigate to="/login" replace />;
  if (onboardingStatus === 'loading') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
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
  if (onboardingStatus === 'required') {
    return <Navigate to="/save-private-key" replace />;
  }
  return <Outlet />;
}
