import { Navigate, Outlet } from 'react-router-dom';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

export function ProtectedRoute() {
  const { session } = useFeedntSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
