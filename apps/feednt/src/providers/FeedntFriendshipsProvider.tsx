import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  useFeedntFriendshipsState,
  type FeedntFriendshipsValue,
} from '@feednt/hooks/useFeedntFriendships.ts';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

const FeedntFriendshipsContext = createContext<FeedntFriendshipsValue | null>(
  null,
);

export function FeedntFriendshipsProvider({ children }: { children: ReactNode }) {
  const { session, feedntUsers } = useFeedntSession();
  const friendships = useFeedntFriendshipsState(
    session?.keyId ?? null,
    feedntUsers.usernameByKeyId,
    feedntUsers.addLocalUser,
  );
  const value = useMemo(() => friendships, [friendships]);

  return (
    <FeedntFriendshipsContext.Provider value={value}>
      {children}
    </FeedntFriendshipsContext.Provider>
  );
}

export function useFeedntFriendships(): FeedntFriendshipsValue {
  const context = useContext(FeedntFriendshipsContext);
  if (!context) {
    throw new Error(
      'useFeedntFriendships must be used within FeedntFriendshipsProvider',
    );
  }
  return context;
}
