# USERS-3 — Get invited via invitation ID

**As** a new key holder  
**I want** a friend to send me an invitation ID  
**So that** I can accept with my private key and join their network.

## Acceptance criteria

- Inviter (registered, has friends) creates an invitation via `POST /friend-invitations` and receives a one-time **invitation ID** (UUID).
- Inviter shares the ID with one person (copy from **Invite friend**, or share the ID shown on pending invitations).
- Invitee opens the invitation accept page with that ID:
  - **Feed Lab / Feednt:** **Accept invite** on Users → **Invitation ID** tab → enter ID → **Open invitation**.
  - **Feed Lab (browser):** open `/invite/:token` directly (e.g. after receiving the ID out of band).
- Invitee loads or generates a key pair and accepts via `POST /friend-invitations/:token/accept`.
- Mutual friendship is created.
- **Both** invitee and inviter have ≥1 friendship → **invitee enters `users`** (inviter already registered).
- After accept, invitee can use feed write APIs; feed shows friends / messages as applicable.

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-3-get-invited-via-id.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
- QR sharing / scanning: `docs/user-stories/users/USERS-3b-invitation-qr-code.md`
