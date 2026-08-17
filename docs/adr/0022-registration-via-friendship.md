# 0022. Registration via friendship

- **Status:** Accepted
- **Date:** 2026-08-17
- **Expands:** [0009](./0009-api-authentication-with-server-minted-redis-nonces.md)

## Context

The API distinguishes **authentication** (valid signed request with nonce) from **registration** (a row in the `users` table). A locally generated key can authenticate before it has ever accepted a friend invitation.

Product rules require that feed write paths and most read paths only work for registered keys, while invitation accept must remain available for unregistered invitees.

## Decision

### Registered user

A **registered user** is a `users` row (`keyId` + `publicKey`). Registration happens when a key gains **at least one friendship**, primarily by accepting a friend invitation link.

`ensureRegisteredAfterFriendship` registers a key in `users` after mutual friendship when `hasFriends(keyId)` is true. Unfriend removes friendship rows only; `users` rows are permanent.

### Request pipeline

After [ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md) `authenticate()`, **`requireRegisteredUser`** middleware runs on `/api` routes except:

| Class     | Routes                                                                          | Auth | Registered                        |
| --------- | ------------------------------------------------------------------------------- | ---- | --------------------------------- |
| Public    | `GET /health`, `POST /api/auth/challenge`, `GET /api/friend-invitations/:token` | No   | No                                |
| Auth-only | `POST /api/friend-invitations/:token/accept`                                    | Yes  | No (invitee registers in handler) |
| Protected | All other `/api/*`                                                              | Yes  | Yes                               |

Unregistered authenticated requests to protected routes receive **`400 Unknown user keyId: <authenticatedKeyId>`** via `assertUsersRegistered`.

### Endpoints and handlers

- **`GET /api/users`** is removed. Friend requests by public key assert the target is already registered server-side (`assertUsersRegistered([targetKeyId])` on `POST /friendships/request`).
- Handler-level **`assertUsersRegistered`** remains only for manifest keyIds on create message/share (actor covered by middleware).

## Consequences

### Positive

- Authentication and registration are explicit, testable gates with a clear error contract for clients.
- Invitation accept stays available for brand-new keys without a `users` row.
- Once registered, keys remain discoverable by public key.

### Negative / limitations

- Clients must treat `Unknown user keyId` for the session key as “not registered yet”.
- Dev/prod bootstrap must seed registered users and at least one friendship so first inviters exist before the invitation graph is live.
- Public-key friend requests require the target to already be in `users` (no “invite unregistered key by public key” path).

## References

- User stories: [`docs/user-stories/users/`](../../docs/user-stories/users/)
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md)
