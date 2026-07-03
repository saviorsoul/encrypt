import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createFeedApi, type FeedApi } from '@encrypt/core/api/feedApi';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
import { useFeedApiAuthStorageSync } from '@lab/hooks/useFeedApiAuthStorageSync.ts';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

const FeedApiContext = createContext<FeedApi | null>(null);

export function FeedApiProvider({ children }: { children: ReactNode }) {
  useFeedApiAuthStorageSync();
  const { keys } = useFeedLabSession();
  const api = useMemo(
    () =>
      createFeedApi({
        baseUrl: getApiBaseUrl(),
        auth: keys.authProvider,
      }),
    [keys.authProvider],
  );
  return <FeedApiContext value={api}>{children}</FeedApiContext>;
}

export function useFeedApi(): FeedApi {
  const api = useContext(FeedApiContext);
  if (!api) {
    throw new Error('useFeedApi must be used within FeedApiProvider');
  }
  return api;
}
