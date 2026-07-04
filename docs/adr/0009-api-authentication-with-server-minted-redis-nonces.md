# 0009. API authentication with server-minted Redis nonces

- **Status:** Accepted
- **Date:** 2026-07-03
- **Supersedes (partial):** [0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md)

## Context

[ADR 0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md) introduced stateless API authentication: ECDSA proofs bound to `{ method, path, query, timeSlot }` (plus `bodyHash` on POST/DELETE), with no server store. Server-minted nonces were deferred for v1 (extra round-trip and store).

That model leaves a **long-horizon pre-signing** gap: a malicious signing oracle (XSS, tampered client — not a cross-origin page; see [ADR 0002](./0002-in-memory-non-extractable-private-key-cache.md)) can put an arbitrary future `timeSlot` in the signable and replay the captured headers when the server clock reaches that window.

The fix is a **server-unpredictable value at signing time**. We adopt signable **v2** with server-minted **nonces** in **Redis** (not Citus — ephemeral churn fits TTL + atomic consume, not distributed Postgres).

### Approaches considered and rejected

| Approach                                           | Why not                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Reject future `timeSlot` only                      | Does not stop store-and-wait pre-signing; breaks fast clocks                |
| Server-anchored signing via `/health` `timeSlot`   | Extra complexity; does not bound pre-signing                                |
| `issuedAt` + max proof age                         | Same attack surface — attacker sets future `issuedAt`                       |
| Citus `auth_nonces` by `keyId`                     | Wrong workload for short-lived tokens; Redis is simpler                     |
| Per-nonce Redis keys (`auth:nonce:{keyId}:{uuid}`) | Orphaned rotation/challenge mints accumulate; one key per `keyId` is enough |

## Decision

### Signable v2

Bump `AUTH_SIGNABLE_VERSION` to **2**. Keep **`timeSlot`** (±1 clock skew) and add server-minted **`nonce`**:

| Verbs       | Signable fields                                              |
| ----------- | ------------------------------------------------------------ |
| GET         | `v`, `keyId`, `method`, `path`, `query`, `timeSlot`, `nonce` |
| POST/DELETE | above + `bodyHash`                                           |

**Request headers:** `X-Key-Id`, `X-Public-Key`, `X-Time-Slot`, `X-Nonce`, `X-Signature`  
**Response header:** `X-Next-Nonce` — replacement nonce minted after successful authentication

### Nonce wire format

- **12 random bytes**, standard **base64** (same style as manifest IVs), via `generateAuthNonce()` in `@encrypt/core/crypto/authProof`
- `parseAuthNonceHeader` rejects non-base64 and wrong lengths (legacy UUID strings are invalid)
- TTL: `AUTH_NONCE_TTL_SECONDS` = **1 hour** (server Redis `EX` and client cache expiry). See [Changes](#changes).

### Challenge + rotation

1. **Bootstrap:** `POST /api/auth/challenge` with `{ keyId }` (public route) → `{ nonce }` in body. Used when the client has no pending nonce.
2. **Authenticated request:** client signs with pending nonce; server verifies ECDSA + `timeSlot`, atomically consumes nonce from Redis, mints next nonce, sets **`X-Next-Nonce`** before running the handler.
3. **Steady state:** client caches `X-Next-Nonce` from the prior response — **one round-trip per API call** after bootstrap.

### Redis

- Key: **`auth:nonce:{keyId}`** (one pending nonce per identity)
- Value: nonce string (base64)
- Mint: `SET … EX 900` — **replaces** any previous unconsumed nonce for that `keyId`
- Consume: Lua **compare-and-delete** (`GET` equals presented nonce → `DEL`); wrong or replayed nonce returns false
- **TTL reclaims stale entries**; single-use is enforced at consume time; `timeSlot` still bounds when the signature is valid at request time

Nonces are not in Citus ([ADR 0008](./0008-citus-sharding-by-key-id.md)).

### Client (`packages/core/src/api/feedApiAuth.ts`)

- **Pending nonce cache** per `keyId`: in-memory map + **`localStorage`** (`encrypt:feed-api-nonce:{keyId}`) with `{ nonce, expiresAt }` JSON so tabs share rotation state
- **`storage` event** handled in feed-lab by `useFeedApiAuthStorageSync` (calls `handleFeedApiAuthStorageEvent`) so tabs share rotation state
- **In-flight coordination:** parallel requests for the same `keyId` wait for the first response’s `X-Next-Nonce` instead of issuing duplicate challenges
- **Per-`keyId` mutex** while building auth headers
- Challenge POST sends **`{ keyId }` only**; `publicKey` remains on signed requests only
- Session clear wipes all cached nonces; switching identities releases in-flight locks for the previous `keyId` but keeps per-`keyId` rotated nonces for reuse

### Middleware

- `authenticate` — verify v2 proof, consume nonce, rotate via `X-Next-Nonce`
- `POST /api/auth/challenge` — exempt from `authenticate` (alongside `GET /health`)
- CORS exposes `X-Next-Nonce` when the browser calls the API cross-origin; feed-lab dev defaults to the Vite proxy (same origin) so response headers are readable

Payload `senderSignature` and the encryption model are unchanged from ADR 0007.

## Consequences

### Positive

- Long-horizon pre-signing closed — nonce cannot be known days in advance
- Single-use replay per nonce (atomic consume)
- Steady-state one round-trip after bootstrap via `X-Next-Nonce`
- Request binding retained (method, path, query, bodyHash)
- One Redis key per `keyId` — no orphaned challenge/rotation entries
- Cross-tab nonce sharing via `localStorage`

### Negative / limitations

- Redis dependency for auth (fail closed if unavailable)
- Bootstrap challenge on first use of a `keyId` in a browser profile, or 401 retry
- Parallel in-flight requests per `keyId` must serialize or retry on nonce race; two tabs can still race the same nonce (one 401 + retry)
- Intercepted signed request replayable once until consumed
- Anyone may request a challenge for any `keyId` (nonce alone does not grant access; private key still required to sign)

## Changes

### 2026-07-04 — [0010](./0010-challenge-reuses-pending-auth-nonce.md)

| Topic                    | As accepted (2026-07-03) | Current                                      |
| ------------------------ | ------------------------ | -------------------------------------------- |
| `AUTH_NONCE_TTL_SECONDS` | 1 hour (`EX 3600`)       | **15 minutes** (`EX 900`)                    |
| Challenge response body  | `{ nonce }`              | `{ nonce, expiresAt }` (server Unix ms)      |
| Challenge route          | always `mint`            | `getOrMint` — reuse pending nonce when valid |

### 2026-07-04 — [0011](./0011-auth-nonce-expires-at-on-rotation.md)

| Topic                   | As accepted (2026-07-03) | Current                                                          |
| ----------------------- | ------------------------ | ---------------------------------------------------------------- |
| Rotation response       | `X-Next-Nonce` only      | `X-Next-Nonce` + `X-Next-Nonce-Expires-At` (Unix ms)           |
| CORS `Expose-Headers`   | `X-Next-Nonce`           | `X-Next-Nonce`, `X-Next-Nonce-Expires-At`                      |

## References

- Related ADRs: [0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md), [0008](./0008-citus-sharding-by-key-id.md), [0002](./0002-in-memory-non-extractable-private-key-cache.md), [0010](./0010-challenge-reuses-pending-auth-nonce.md), [0011](./0011-auth-nonce-expires-at-on-rotation.md)
