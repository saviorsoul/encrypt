# USERS-7 — Multiple keys on one device

**As** a power user  
**I want** several key pairs in the app  
**So that** I can separate identities or test.

## Acceptance criteria

- Each keyId has independent registration and friendship graph.
- Switching keys changes registered vs unregistered behavior per key.

## Related

- E2E: `apps/feed-lab/e2e/users/USERS-7-multiple-keys-on-one-device.spec.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
