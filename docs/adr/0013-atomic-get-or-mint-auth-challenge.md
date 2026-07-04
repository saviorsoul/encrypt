# 0013. Atomic `getOrMint` for auth challenge

- **Status:** Accepted
- **Date:** 2026-07-04
- **Expands:** [0010](./0010-challenge-reuses-pending-auth-nonce.md)

## Context

[ADR 0010](./0010-challenge-reuses-pending-auth-nonce.md) routes `POST /api/auth/challenge` through `getOrMintAuthNonce`: reuse the pending Redis entry when it has sufficient remaining lifetime, otherwise mint.

The first implementation was **read-then-write** — `get(keyId)`, check near-expiry, then `mint(keyId)` if needed. That is not atomic. Two concurrent challenge requests for the same `keyId` when no nonce exists (or both see a near-expiry entry) can both mint; the last `SET` wins and the other caller receives a nonce that is **no longer** in Redis → **401** on sign.

Sequential repeat challenges were safe ([0010](./0010-challenge-reuses-pending-auth-nonce.md)); parallel first-time or remint races were not.

## Decision

Add **`getOrMint(keyId)`** to `AuthNonceStore` and route `getOrMintAuthNonce` through it exclusively (no separate `get` + `mint` at the call site).

### Redis — Lua script

One `EVAL` per challenge:

1. `GET` + `PTTL` on `auth:nonce:{keyId}`
2. If a value exists and `PTTL >= AUTH_NONCE_MIN_REMAINING_SECONDS` (ms), return `{ nonce, pttl }`
3. Otherwise `SET` the caller-supplied candidate nonce with `EX AUTH_NONCE_TTL_SECONDS` and return `{ nonce, pttl }`

Redis executes the script atomically per key. A second concurrent challenger either reuses the first caller’s minted nonce or mints only when the script decides remint is required — it cannot clobber a valid pending entry from a sibling request.

The candidate nonce is generated in Node and passed as `ARGV`; the script uses it only when step 3 runs. If another invocation minted first, step 2 returns that entry instead.

### In-memory test store

`getOrMint` performs check-and-set in one synchronous `async` function body (no `await` between read and write), which is sufficient for Vitest under Node’s single-threaded event loop.

### Unchanged

- `mint` — still unconditional replace (post-auth rotation via `authenticate`)
- `get` — retained for read-only inspection if needed
- `consume` — unchanged Lua compare-and-delete

## Consequences

### Positive

- Parallel bootstrap challenges for the same `keyId` return the same nonce and `expiresAt`.
- Matches the [0010](./0010-challenge-reuses-pending-auth-nonce.md) contract under concurrency, not only for sequential repeat calls.

### Negative / limitations

- Redis: one `EVAL` per challenge (acceptable; same order of magnitude as before).
- Candidate nonce in `ARGV` is discarded when the script reuses an existing entry (harmless extra random bytes).

## Alternatives considered

### Keep read-then-write; rely on client mutex only

- `feedApiAuth.ts` serializes per `keyId` in one browser profile, but does not protect cross-client, curl, or multi-instance parallel challenges.

### `SET … NX` only

- Does not handle near-expiry remint or reuse in one atomic step; still needs `PTTL` check inside the same script.

## References

- Code: `apps/api/src/services/authNonce.ts`
- Tests: `apps/api/src/tests/authNonce.test.ts` (`returns the same nonce from concurrent getOrMint calls`)
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0010](./0010-challenge-reuses-pending-auth-nonce.md), [0011](./0011-auth-nonce-expires-at-on-rotation.md)
