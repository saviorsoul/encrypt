# 0022. Registration via friendship

- **Status:** Accepted
- **Date:** 2026-08-17
- **Expands:** [0009](./0009-api-authentication-with-server-minted-redis-nonces.md)

## Context

The API distinguishes **authentication** (valid signed request with nonce) from **registration** (a row in the `users` table). A locally generated key can authenticate before it has ever accepted a friend invitation.

Product rules require that feed write paths and most read paths only work for registered keys, while invitation accept must remain available for unregistered invitees who authenticate with their key but do not yet have a `users` row.

Open registration for some deployments is covered by [0023](./0023-feed-invitational-only-deployment-mode.md).

## Decision

### Registered user

A **registered user** is a `users` row (`keyId` + `publicKey`). Registration happens when a key gains **at least one friendship**, primarily by accepting a friend invitation link.

`ensureRegisteredAfterFriendship` registers a key in `users` after mutual friendship when `hasFriends(keyId)` is true. Unfriend removes friendship rows only; `users` rows are permanent.

When **`VITE_FEED_INVITATIONAL_ONLY=false`** ([0023](./0023-feed-invitational-only-deployment-mode.md)), authenticated keys may also enter `users` via lazy auto-registration on the first protected API request, without a friendship.

### Request pipeline

After [ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md) `authenticate()`, **`requireRegisteredUser(feedInvitationalOnly)`** runs on `/api` routes except:

| Class     | Routes                                                                          | Auth | Registered                                                                 |
| --------- | ------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| Public    | `GET /health`, `POST /api/auth/challenge`, `GET /api/friend-invitations/:token` | No   | No                                                                         |
| Auth-only | `POST /api/friend-invitations/:token/accept`                                    | Yes  | No (invitee registers in handler)                                          |
| Protected | All other `/api/*`                                                              | Yes  | Yes — or auto-registered on first request when `VITE_FEED_INVITATIONAL_ONLY=false` |

On protected routes:

- **Invitational-only** (`VITE_FEED_INVITATIONAL_ONLY=true` or unset): unregistered authenticated keys receive **`400 Unknown user keyId: <authenticatedKeyId>`** via `assertCurrentUserRegistered`.
- **Open** (`VITE_FEED_INVITATIONAL_ONLY=false`): `registerIfAbsent` from auth headers before the handler runs ([0023](./0023-feed-invitational-only-deployment-mode.md)).

Invitation accept requires authentication but not a prior `users` row — the onboarding path for brand-new keys in invitational-only mode. Public-key friend requests require the target to already be registered.

### Endpoints and handlers

- **`GET /api/users`** is removed. Friend requests by public key assert the target is already registered server-side (`assertUsersRegistered([targetKeyId])` on `POST /friendships/request`).
- **`POST /friend-invitations`** requires the inviter to be **registered** (`userRepository.exists`); they do not need existing friends.
- Handler-level **`assertUsersRegistered`** remains only for manifest keyIds on create message/share (actor covered by middleware).

## Consequences

### Positive

- Authentication and registration are explicit, testable gates with a clear error contract for clients.
- Invitation accept stays available for brand-new keys without a `users` row.
- Once registered, keys remain discoverable by public key.
- Registered users with zero friends may still create invitation links.

### Negative / limitations

- Clients must treat `Unknown user keyId` for the session key as “not registered yet” (invitational-only mode).
- Invitational-only deployments must seed registered users and at least one friendship so first inviters exist before the invitation graph is live; open mode ([0023](./0023-feed-invitational-only-deployment-mode.md)) does not require this seed.
- Public-key friend requests require the target to already be in `users` (no “invite unregistered key by public key” path).

## Changes

### 2026-09-08 — [0023](./0023-feed-invitational-only-deployment-mode.md)

| Topic | As accepted | Current |
| ----- | ----------- | ------- |
| Registration gate | Always invitation path before protected routes | **`VITE_FEED_INVITATIONAL_ONLY=false`** auto-registers on first protected request (open mode); see [0023](./0023-feed-invitational-only-deployment-mode.md) |
| `requireRegisteredUser` | No flag; always `assertCurrentUserRegistered` | Takes `feedInvitationalOnly`; open mode uses `registerIfAbsent` |
| Invitation create | Inviter must have friends (`hasFriends`) | Inviter must be **registered** only |
| First inviters | Seed required before invitation graph is live | Seed required in invitational-only mode; optional in open mode |

## References

- User stories: [`docs/user-stories/users/`](../../docs/user-stories/users/)
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0023](./0023-feed-invitational-only-deployment-mode.md)
