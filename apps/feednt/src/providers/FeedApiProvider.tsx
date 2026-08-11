import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createFeedApi, type FeedApi } from '@encrypt/core/api/feedApi';
import { getApiBaseUrl } from '@feednt/lib/apiBaseUrl.ts';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

const FeedApiContext = createContext<FeedApi | null>(null);

export function FeedApiProvider({ children }: { children: ReactNode }) {
  const { session } = useFeedntSession();

  const api = useMemo(() => {
    if (!session) {
      return null;
    }
    return createFeedApi({
      baseUrl: getApiBaseUrl(),
      auth: session.authProvider,
    });
  }, [session]);

  if (!api) {
    return <>{children}</>;
  }

  return <FeedApiContext.Provider value={api}>{children}</FeedApiContext.Provider>;
}

export function useFeedApi(): FeedApi {
  const api = useContext(FeedApiContext);
  if (!api) {
    throw new Error('useFeedApi requires an authenticated session.');
  }
  return api;
}

export function useOptionalFeedApi(): FeedApi | null {
  return useContext(FeedApiContext);
}
