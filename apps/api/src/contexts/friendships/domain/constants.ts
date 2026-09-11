export const FRIENDSHIP_REQUEST_PENDING = 'pending';
export const FRIENDSHIP_REQUEST_REJECTED = 'rejected';

export const FRIEND_INVITATION_PENDING = 'pending';
export const FRIEND_INVITATION_CONSUMED = 'consumed';

export const FRIENDSHIP_MUTE_SCOPE_MESSAGES = 'messages' as const;
export const FRIENDSHIP_MUTE_SCOPE_SHARES = 'shares' as const;

export type FriendshipMuteScope =
  | typeof FRIENDSHIP_MUTE_SCOPE_MESSAGES
  | typeof FRIENDSHIP_MUTE_SCOPE_SHARES;
