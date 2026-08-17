# USERS-1 — Generate a new key locally

**As** someone installing the app  
**I want** to generate or import a private/public key pair on my device  
**So that** I can use the app without any server account signup.

## Acceptance criteria

- Key material stays on device (safe storage / file).
- Server never generates key pairs.
- App can derive keyId from public key and show an empty feed state.
- No `users` row exists yet for this keyId.

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-1-generate-new-key-locally.spec.ts`
- API: (none — local only)
