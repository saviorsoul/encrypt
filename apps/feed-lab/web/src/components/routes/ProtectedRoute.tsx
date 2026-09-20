import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

export function ProtectedRoute() {
  const { keys } = useFeedLabSession();
  if (!keys.keyId) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
