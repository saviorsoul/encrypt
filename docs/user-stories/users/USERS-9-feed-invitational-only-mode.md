# USERS-9 — Feed invitational-only deployment mode

**As** an operator deploying the Feed API  
**I want** to choose whether new keys must join via invitation  
**So that** each deployment can require invitations or allow open registration.

## Acceptance criteria

### Invitational-only

- `VITE_FEED_INVITATIONAL_ONLY=true`, or unset (defaults to `true`).
- Authenticated keys **not** in `users` are rejected on protected `/api/*` routes → `400 Unknown user keyId` (see USERS-2).
- `POST /friendships/request` still requires the **target** to be registered (USERS-4). In invitational-only mode the **requester** must also have at least one friend; in open mode a registered requester with zero friends may send by public key.
- `POST /friend-invitations` requires the inviter to be **registered** (`users` row); they do **not** need existing friends (supports USERS-6: zero friends but still registered).

### Open mode (non-invitational)

- `VITE_FEED_INVITATIONAL_ONLY=false`.
- Any authenticated key is **auto-registered** (`registerIfAbsent`) on the first protected API request.
- No invitation is required before using inbox, messages, shares, or comments.
- Accept-invite UI (login, Users, feed onboarding) remains available as an onboarding path and way to add friends.
- Login screens require GDPR consent (personal data notice link) before sign-in actions; invitation accept keeps its own consent on the invite page.
- API **logs a warning at startup** that it is running in open mode.
- Manifest recipient checks unchanged: recipients must still be registered keys.

### Configuration

- Env var: `VITE_FEED_INVITATIONAL_ONLY` (`true` / `false`, documented in `.env.example`). Shared by API (runtime) and Vite client apps (build-time).
- Applies to any environment, including production; default is `true` when unset.

## Related

- USERS-2 — authenticated but not registered (invitational-only behavior)
- USERS-3 — get invited via invitation ID
- USERS-4 — get invited by public key (target must already be registered)
- USERS-6 — lose all friends but stay registered (may still send invitations)
- ADR: [0023 — Feed invitational-only deployment mode](../../adr/0023-feed-invitational-only-deployment-mode.md) (expands [0022](../../adr/0022-registration-via-friendship.md))
- API: `apps/api/src/tests/feedInvitationalOnlyConfig.test.ts`, `apps/api/src/tests/registeredUserGate.test.ts`, `apps/api/src/tests/createFriendInvitation.handler.test.ts`, `apps/api/src/tests/createFriendshipRequest.handler.test.ts`
