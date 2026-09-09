# USERS-6 — Lose all friends but stay registered

**As** a user who unfriended everyone  
**I want** to remain in the `users` table  
**So that** I can still be found by public key and re-add friends without re-invitation.

## Acceptance criteria

- `DELETE /friendships` removes friendship rows only.
- `users` row remains.
- Create/share/comment still allowed if actor registered (may have zero friends → no recipients for new messages; UI handles empty network).
- Registered users with zero friends may still create friend invitation links (`POST /friend-invitations`).

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-6-lose-friends-stay-registered.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`, `apps/api/src/tests/createFriendInvitation.handler.test.ts`
- Clearing the account (inactive, cannot re-register): `docs/user-stories/users/USERS-8-delete-personal-data.md`
