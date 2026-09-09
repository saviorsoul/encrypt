# 0023. Feed invitational-only deployment mode

- **Status:** Accepted
- **Date:** 2026-09-08
- **Expands:** [0022](./0022-registration-via-friendship.md)

## Context

[ADR 0022](./0022-registration-via-friendship.md) defines registration as a `users` row, typically gained after accepting a friend invitation and establishing a friendship. That model fits deployments where every participant must be invited into the network.

Some deployments — including production — need **open registration**: any holder of a valid key pair may use the feed after authentication, without accepting an invitation first. Operators should choose the mode per deployment without code changes.

## Decision

### Feature flag

**`VITE_FEED_INVITATIONAL_ONLY`** (server env, parsed in [`readConfig()`](../../apps/api/src/config.ts)):

| Value                     | Mode              | Behavior                                                            |
| ------------------------- | ----------------- | ------------------------------------------------------------------- |
| `true` or unset (default) | Invitational-only | [ADR 0022](./0022-registration-via-friendship.md) registration gate |
| `false`                   | Open              | Auto-register authenticated keys on first protected request         |

Default is **`true`** when unset so existing deployments keep invitation-only behavior without configuration.

The flag applies to **any environment** (local, staging, production). The same env var is read by the API at runtime and by Vite client apps at build time via [`isFeedInvitationalOnlyEnabled()`](../../packages/core/src/feed/feedInvitationalOnlyConfig.ts).

### Middleware

[`requireRegisteredUser(feedInvitationalOnly)`](../../apps/api/src/middleware/requireRegisteredUser.ts) runs after `authenticate()` on protected `/api` routes (unchanged route classes from ADR 0022):

- **Invitational-only:** `assertCurrentUserRegistered(keyId)` → `400 Unknown user keyId` when absent.
- **Open:** `userRepository.registerIfAbsent({ keyId, publicKey })` from auth headers before the handler runs.

Public routes (health, challenge, read invitation by token) and **invitation accept** skip the registration gate: invitation accept still requires authentication, but not a prior `users` row.

### Startup observability

When `feedInvitationalOnly` is `false`, [`index.ts`](../../apps/api/src/index.ts) logs a **warning** before listening so operators can see open mode in process logs.

### Invitation create (refinement)

`POST /friend-invitations` requires the inviter to be **registered** (`userRepository.exists`), not to have existing friends. Registered users who unfriended everyone ([USERS-6](../../docs/user-stories/users/USERS-6-lose-friends-stay-registered.md)) may still create invitation links.

### Friendship request (refinement)

`POST /friendships/request` still requires the **target** to be registered. In **invitational-only** mode the **requester** must also have at least one friend (USERS-4). In **open** mode a registered requester with zero friends may send by public key.

### Unchanged in open mode

- Manifest recipient checks on create message/share still require recipient keyIds in `users`.
- Invitation accept flow and friendship-based registration (`ensureRegisteredAfterFriendship`) remain available in both modes.

## Consequences

### Positive

- One deploy-time switch for invitation-only vs open networks.
- Open mode removes the bootstrap problem of seeding first inviters when invitations are not required.
- Invitational-only remains the safe default for deployments that do not set the env var.
- Registration semantics (`users` table, inactive account rules) stay consistent in both modes.

### Negative / limitations

- Open mode allows any authenticated key to join; operators must set `VITE_FEED_INVITATIONAL_ONLY=false` deliberately.
- Clients read `VITE_FEED_INVITATIONAL_ONLY` at build time to gate registration-dependent UI (e.g. blocking create message while unregistered); accept-invite flows remain available in both modes.

## Alternatives considered

### Bypass `requireRegisteredUser` entirely in open mode

Rejected: would skip inactive-user handling and leave manifest actors without `users` rows until a separate registration path ran.

### Explicit `POST /api/users/register` endpoint

Rejected for v1: extra client round-trip; lazy registration in middleware is sufficient.

### Expose mode on `GET /api/health`

Rejected: health is public and should stay minimal; operators configure the server env directly.

## References

- User story: [USERS-9 — Feed invitational-only deployment mode](../../docs/user-stories/users/USERS-9-feed-invitational-only-mode.md)
- Code: [`apps/api/src/config.ts`](../../apps/api/src/config.ts), [`apps/api/src/middleware/requireRegisteredUser.ts`](../../apps/api/src/middleware/requireRegisteredUser.ts), [`apps/api/src/contexts/friendships/application/invitations/commands/createFriendInvitation/createFriendInvitation.handler.ts`](../../apps/api/src/contexts/friendships/application/invitations/commands/createFriendInvitation/createFriendInvitation.handler.ts), [`apps/api/src/contexts/friendships/application/requests/commands/createFriendshipRequest/createFriendshipRequest.handler.ts`](../../apps/api/src/contexts/friendships/application/requests/commands/createFriendshipRequest/createFriendshipRequest.handler.ts)
- Tests: `apps/api/src/tests/feedInvitationalOnlyConfig.test.ts`, `registeredUserGate.test.ts`, `createFriendInvitation.handler.test.ts`, `createFriendshipRequest.handler.test.ts`
- Related ADRs: [0022](./0022-registration-via-friendship.md)
