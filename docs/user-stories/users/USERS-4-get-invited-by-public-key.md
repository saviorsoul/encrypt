# USERS-4 — Get invited by public key

**As** a new key holder  
**I want** to share my public key with someone I know in real life  
**So that** they can add me from Users using my public key.

## Acceptance criteria

- Friend (registered, has friends) sends friend request by public key only if **target keyId is already in `users`**.
- Server: `assertUsersRegistered([targetKeyId])` on `POST /friendships/request`; no client-side `GET /api/users` scan.
- Client: `ensureBackendUserFromPublicKey` parses public key → keyId locally; server error if target not registered.
- Target accepts incoming request → friendship established.
- Aligns with feed empty-state: share your public key so a registered friend can add you.

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-4-get-invited-by-public-key.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
