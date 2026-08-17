import {
  FRIEND_INVITATION_ACCEPT_SUFFIX,
  FRIEND_INVITATIONS_PATH_PREFIX,
} from '@/config.js';

/** Token segment for GET `/friend-invitations/:token` (not list or accept). */
export function parseFriendInvitationTokenPath(path: string): string | null {
  if (!path.startsWith(FRIEND_INVITATIONS_PATH_PREFIX)) {
    return null;
  }

  const remainder = path.slice(FRIEND_INVITATIONS_PATH_PREFIX.length);
  if (remainder.length === 0 || remainder.includes('/')) {
    return null;
  }

  return remainder;
}

export function isPublicGetFriendInvitation(
  method: string,
  path: string,
): boolean {
  return method === 'GET' && parseFriendInvitationTokenPath(path) !== null;
}

export function isAuthOnlyPostFriendInvitationAccept(
  method: string,
  path: string,
): boolean {
  if (
    method !== 'POST' ||
    !path.endsWith(`/${FRIEND_INVITATION_ACCEPT_SUFFIX}`)
  ) {
    return false;
  }

  const invitationPath = path.slice(
    0,
    path.length - FRIEND_INVITATION_ACCEPT_SUFFIX.length - 1,
  );
  return parseFriendInvitationTokenPath(invitationPath) !== null;
}
