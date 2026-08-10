import type { Friendship, FriendshipRequest } from '@encrypt/core/api/feedApi';

export type PendingInvitationLink = {
  token: string;
  href: string;
  label: string | null;
  createdAt: string;
};

export type FriendshipsCacheEntry = {
  friendships: Friendship[];
  invitationLabelByToken: Record<string, string>;
  incomingRequests: FriendshipRequest[];
  outgoingRequests: FriendshipRequest[];
  pendingInvitations: PendingInvitationLink[];
  hasFriendships: boolean;
  hasUsersData: boolean;
};

const cacheByOwnerKeyId = new Map<string, FriendshipsCacheEntry>();

export function getFriendshipsCache(
  ownerKeyId: string,
): FriendshipsCacheEntry | null {
  return cacheByOwnerKeyId.get(ownerKeyId) ?? null;
}

export function setFriendshipsCache(
  ownerKeyId: string,
  entry: FriendshipsCacheEntry,
): void {
  cacheByOwnerKeyId.set(ownerKeyId, entry);
}

export function clearFriendshipsCache(ownerKeyId?: string): void {
  if (ownerKeyId) {
    cacheByOwnerKeyId.delete(ownerKeyId);
    return;
  }
  cacheByOwnerKeyId.clear();
}

export function cacheHasFriendships(
  cached: FriendshipsCacheEntry | null,
): cached is FriendshipsCacheEntry {
  return cached?.hasFriendships === true;
}

export function cacheHasUsersData(
  cached: FriendshipsCacheEntry | null,
): cached is FriendshipsCacheEntry {
  return cached?.hasUsersData === true;
}
