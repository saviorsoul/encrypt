import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  useFeedLabFriendshipsState,
  type FeedLabFriendshipsValue,
} from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

const FeedLabFriendshipsContext = createContext<FeedLabFriendshipsValue | null>(
  null,
);

export function FeedLabFriendshipsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { keys, feedLabUsers } = useFeedLabSession();
  const friendships = useFeedLabFriendshipsState(
    keys.keyId,
    feedLabUsers.usernameByKeyId,
    feedLabUsers.addLocalUser,
  );
  const value = useMemo(() => friendships, [friendships]);

  return (
    <FeedLabFriendshipsContext.Provider value={value}>
      {children}
    </FeedLabFriendshipsContext.Provider>
  );
}

export function useFeedLabFriendships(): FeedLabFriendshipsValue {
  const context = useContext(FeedLabFriendshipsContext);
  if (!context) {
    throw new Error(
      'useFeedLabFriendships must be used within FeedLabFriendshipsProvider',
    );
  }
  return context;
}
