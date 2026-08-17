# USERS-2 — Authenticated but not registered

**As** a holder of a new key pair  
**I want** the app to unlock my key locally  
**So that** the server accepts signed requests from my keyId.

## Acceptance criteria

- Layer 1: auth middleware validates signature + nonce (Redis).
- Layer 2: registration middleware **not** applied on invitation accept; on other protected routes → `400 Unknown user keyId`.
- `POST /messages`, `POST /shares`, `POST /comments` blocked by middleware before handler.
- UI: Create message, Share, Comment disabled or blocked with clear guidance (feed empty-state card).

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-2-authenticated-but-not-registered.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
