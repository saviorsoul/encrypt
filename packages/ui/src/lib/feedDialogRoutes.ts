function encodeRouteId(id: string): string {
  return encodeURIComponent(id);
}

export const feedPageDialogRoutePatterns = {
  identity: '/identity/:keyId',
  share: '/share/:messageId',
  addFriend: '/add-friend',
  acceptInvitation: '/accept-invitation',
  scanInvitation: '/scan-invitation',
} as const;

export const feedUsersDialogRoutePatterns = {
  identity: '/users/identity/:keyId',
  shareHistory: '/users/share-history/:keyId',
  unfriend: '/users/unfriend/:keyId',
  acceptRequest: '/users/accept-request/:keyId',
  publicKey: '/users/public-key/:keyId',
  invitationQr: '/users/invitation-qr/:token',
  removeInvitation: '/users/remove-invitation/:token',
  addFriend: '/users/add-friend',
  acceptInvitation: '/users/accept-invitation',
  scanInvitation: '/users/scan-invitation',
} as const;

export const feedDialogRoutes = {
  feed: () => '/feed',
  createMessage: () => '/create-message',
  shareMessage: (messageId: string) => `/share/${encodeRouteId(messageId)}`,
  identity: (keyId: string) => `/identity/${encodeRouteId(keyId)}`,
  addFriend: () => '/add-friend',
  acceptInvitation: () => '/accept-invitation',
  scanInvitation: () => '/scan-invitation',
  users: () => '/users',
  usersIdentity: (keyId: string) => `/users/identity/${encodeRouteId(keyId)}`,
  usersShareHistory: (keyId: string) =>
    `/users/share-history/${encodeRouteId(keyId)}`,
  usersUnfriend: (keyId: string) => `/users/unfriend/${encodeRouteId(keyId)}`,
  usersAddFriend: () => '/users/add-friend',
  usersAcceptInvitation: () => '/users/accept-invitation',
  usersScanInvitation: () => '/users/scan-invitation',
  usersAcceptRequest: (keyId: string) =>
    `/users/accept-request/${encodeRouteId(keyId)}`,
  usersPublicKey: (keyId: string) =>
    `/users/public-key/${encodeRouteId(keyId)}`,
  usersInvitationQr: (token: string) =>
    `/users/invitation-qr/${encodeRouteId(token)}`,
  usersRemoveInvitation: (token: string) =>
    `/users/remove-invitation/${encodeRouteId(token)}`,
} as const;

export function usersDrawerOpenFromPathname(pathname: string): boolean {
  return pathname === '/users' || pathname.startsWith('/users/');
}

export function createMessageDialogOpenFromPathname(pathname: string): boolean {
  return pathname.startsWith('/create-message');
}
