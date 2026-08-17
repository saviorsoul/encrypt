# USERS-3b — In-app invitation accept (future)

**As** a new key holder using Feednt on desktop or mobile  
**I want** to accept an invitation link inside the app  
**So that** I can join a friend's network with my locally stored key.

## Acceptance criteria (future — not implemented)

- Same API as web: `POST /api/friend-invitations/:token/accept`.
- Same registration rules: friendship established → invitee registered in `users`.
- Invite URL opens inside `@feednt/local` or mobile app; uses safe-storage key instead of browser invite page.

## Related

- E2E: (future `@feednt/local` Playwright)
- API: same as USERS-3
