import React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { usePrivateKeyOnboardingGuard } from '@/hooks/usePrivateKeyOnboardingGuard.ts';

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
  if (onboardingStatus === 'required') {
    return <Navigate to="/save-private-key" replace />;
  }
  return <Outlet />;
}
