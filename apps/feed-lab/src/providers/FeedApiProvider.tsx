import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FeedApi } from '@encrypt/core/api/feedApi';
import { getFeedApi } from '@lab/lib/feedApiClient.ts';

const FeedApiContext = createContext<FeedApi | null>(null);

export function FeedApiProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => getFeedApi(), []);
  return <FeedApiContext value={api}>{children}</FeedApiContext>;
}

export function useFeedApi(): FeedApi {
  const api = useContext(FeedApiContext);
  if (!api) {
    throw new Error('useFeedApi must be used within FeedApiProvider');
  }
  return api;
}
