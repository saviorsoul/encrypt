# 0011. Auth nonce `expiresAt` on rotation and stable Redis expiry

- **Status:** Accepted
- **Date:** 2026-07-04
- **Expands:** [0010](./0010-challenge-reuses-pending-auth-nonce.md)

## Context

[ADR 0010](./0010-challenge-reuses-pending-auth-nonce.md) added server-authoritative **`expiresAt`** (Unix ms) to the challenge response so clients do not sign with nearly-expired nonces. Steady-state rotation after successful authentication still returned only **`X-Next-Nonce`**; the client (`feedApiAuth.ts`) assumed `Date.now() + AUTH_NONCE_TTL_SECONDS` when caching the rotated nonce. Bootstrap and steady-state therefore used different expiry sources (server vs local clock).

Separately, repeated `POST /api/auth/challenge` calls for the same unconsumed nonce correctly returned the **same nonce** ([0010](./0010-challenge-reuses-pending-auth-nonce.md)) but **`expiresAt` drifted forward** on each response. The Redis store derived expiry as `Date.now() + TTL * 1000` using Redis **`TTL`** (whole seconds). Between reads within the same second, `TTL` is unchanged while `Date.now()` advances, so the computed absolute expiry slides even though the Redis key’s real deadline does not.

## Decision

### Rotation carries server `expiresAt`

After consume, `authenticate` mints the next nonce and sets two response headers:

| Header | Value |
| ------ | ----- |
| `X-Next-Nonce` | Rotated nonce (unchanged wire format) |
| `X-Next-Nonce-Expires-At` | Unix ms expiry from the mint |

`mintAuthNonce` returns `{ nonce, expiresAtMs }` (`AuthNonceEntry`). CORS exposes both headers for cross-origin browser clients.

The client (`captureFeedApiNextNonce` in `feedApiAuth.ts`) stores `{ nonce, expiresAt }` from `X-Next-Nonce-Expires-At` when present, with the same `AUTH_NONCE_MIN_REMAINING_SECONDS` discard rule as challenge bootstrap. Falls back to local TTL only when the header is absent (backward compatibility).

### Stable absolute expiry from Redis `PTTL`

`AuthNonceStore` Redis `mint` and `get` compute:

```
expiresAtMs = Date.now() + PTTL(key)
```

using Redis **`PTTL`** (milliseconds), not **`TTL`** (seconds). As wall clock advances, remaining PTTL decreases by the same amount, so repeated reads of an unchanged key return the **same** `expiresAtMs` (within sub-millisecond timing). The in-memory test store continues to store a fixed `expiresAtMs` at mint time.

Near-expiry remint in `getOrMintAuthNonce` still uses `expiresAtMs` against `AUTH_NONCE_MIN_REMAINING_SECONDS`; no change to consume or challenge-reuse semantics.

### Updated flow

1. **Bootstrap:** `POST /api/auth/challenge` → `{ nonce, expiresAt }` (unchanged from 0010; `expiresAt` now stable on reuse).
2. **Authenticated request:** verify, consume, mint → `X-Next-Nonce` + `X-Next-Nonce-Expires-At`.
3. **Steady state:** client caches both values from the prior response — same expiry contract as bootstrap.

## Consequences

### Positive

- Bootstrap and steady-state share server-authoritative expiry; client clock skew affects neither path when headers are present.
- Repeated challenge calls for the same pending nonce return identical `nonce` **and** `expiresAt`.
- `AUTH_NONCE_MIN_REMAINING_SECONDS` applies consistently to cached nonces from challenge and rotation.

### Negative / limitations

- One additional response header on every authenticated response; clients must read it for best expiry accuracy (fallback remains).
- `GET` + `PTTL` are two Redis round-trips on read; a Lua script could combine them later if needed.
- Minor sub-ms jitter remains if `GET` and `PTTL` are not atomic.

## Alternatives considered

### Keep client-computed TTL for rotation only

- Simpler wire format, but reintroduces clock skew between bootstrap and steady state.

### Store `expiresAtMs` in the Redis value (e.g. JSON)

- Perfect stability without PTTL math, but changes the value format and migration for live keys.

### Use `TTL` and round `expiresAt` to second boundaries

- Still drifts within a second; does not fix the observed ~500 ms slide on back-to-back challenges.

## References

- Code: `apps/api/src/middleware/authenticate.ts`, `apps/api/src/services/authNonce.ts`, `packages/core/src/api/feedApiAuth.ts`, `packages/core/src/crypto/authProof.ts`
- Tests: `apps/api/src/tests/authChallenge.test.ts`, `apps/api/src/tests/authNonce.test.ts`
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0010](./0010-challenge-reuses-pending-auth-nonce.md)
