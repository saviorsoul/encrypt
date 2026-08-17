# USERS-5 — Registered user: messaging

**As** a registered key holder with friends  
**I want** to create messages, share, and comment  
**So that** I can use the encrypted feed.

## Acceptance criteria

- Actor keyId in `users`.
- All manifest recipient keyIds in `users`.
- Successful `POST /messages`, `POST /shares`, `POST /comments`.

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-5-registered-user-messaging.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
