import React, { createContext, useContext, type ReactNode } from 'react';
import { useFeedLabUsers } from '@lab/hooks/useFeedLabUsers.ts';
import { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type FeedLabSessionContextValue = {
  keys: ReturnType<typeof usePrivateKeySession>;
  feedLabUsers: ReturnType<typeof useFeedLabUsers>;
};

const FeedLabSessionContext = createContext<FeedLabSessionContextValue | null>(
  null,
);

export function FeedLabSessionProvider({ children }: { children: ReactNode }) {
  const keys = usePrivateKeySession();
  const feedLabUsers = useFeedLabUsers();

  return (
    <FeedLabSessionContext.Provider value={{ keys, feedLabUsers }}>
      {children}
    </FeedLabSessionContext.Provider>
  );
}

export function useFeedLabSession(): FeedLabSessionContextValue {
  const context = useContext(FeedLabSessionContext);
  if (!context) {
    throw new Error(
      'useFeedLabSession must be used within FeedLabSessionProvider',
    );
  }
  return context;
}
