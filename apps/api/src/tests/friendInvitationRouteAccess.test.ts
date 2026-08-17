import { describe, expect, it } from 'vitest';
import {
  isAuthOnlyPostFriendInvitationAccept,
  isPublicGetFriendInvitation,
  parseFriendInvitationTokenPath,
} from '../routes/friendInvitationRouteAccess.js';

describe('friendInvitationRouteAccess', () => {
  it('parses GET invitation by token', () => {
    expect(parseFriendInvitationTokenPath('/api/friend-invitations/abc')).toBe(
      'abc',
    );
  });

  it('rejects list and accept paths', () => {
    expect(
      parseFriendInvitationTokenPath('/api/friend-invitations'),
    ).toBeNull();
    expect(
      parseFriendInvitationTokenPath('/api/friend-invitations/abc/accept'),
    ).toBeNull();
  });

  it('classifies public GET and auth-only accept', () => {
    expect(
      isPublicGetFriendInvitation('GET', '/api/friend-invitations/token'),
    ).toBe(true);
    expect(isPublicGetFriendInvitation('GET', '/api/friend-invitations')).toBe(
      false,
    );

    expect(
      isAuthOnlyPostFriendInvitationAccept(
        'POST',
        '/api/friend-invitations/abc/accept',
      ),
    ).toBe(true);
    expect(
      isAuthOnlyPostFriendInvitationAccept(
        'POST',
        '/api/friend-invitations/abc',
      ),
    ).toBe(false);
  });
});
