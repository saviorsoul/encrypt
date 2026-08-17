# USERS-3 — Get invited via link (web today)

**As** a new key holder  
**I want** a friend to send me an invitation link  
**So that** I can accept with my private key and join their network.

## Acceptance criteria

- Inviter (registered, has friends) creates link via `POST /friend-invitations`.
- Invitee opens link in browser, loads/generates key, accepts via `POST /friend-invitations/:token/accept`.
- Mutual friendship is created.
- **Both** invitee and inviter have ≥1 friendship → **invitee enters `users`** (inviter already registered).
- After accept, invitee can use feed write APIs; feed shows friends / messages as applicable.

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-3-get-invited-via-link.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
