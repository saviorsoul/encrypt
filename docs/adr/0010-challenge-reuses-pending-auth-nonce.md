# 0010. Challenge reuses pending auth nonce

- **Status:** Accepted
- **Date:** 2026-07-04
- **Expands:** [0009](./0009-api-authentication-with-server-minted-redis-nonces.md)

## Context

[ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md) defines bootstrap via `POST /api/auth/challenge` and steady-state rotation via `X-Next-Nonce` after successful authentication. The Redis store holds **one pending nonce per `keyId`**; `mint` always `SET`s a fresh value and **replaces** any unconsumed entry.

`POST /api/auth/challenge` is intentionally **public** — no authentication is required to bootstrap a nonce. ADR 0009 notes that anyone may request a challenge for any `keyId`, because the nonce alone does not grant access; the private key is still required to sign.

The initial implementation called `mintAuthNonce` on **every** challenge request. Combined with the open endpoint, that created an **authentication interruption** vector:

1. Victim calls challenge for their `keyId` and receives nonce `N`.
2. Victim signs a request with `N` (or is about to submit it).
3. Attacker calls challenge with the **same `keyId`**.
4. Server mints nonce `N'`, **replacing `N`** in Redis.
5. Victim’s signed request fails consume (`N` is no longer pending) → **401**.

No private key or prior access is needed — only knowledge of the victim’s public `keyId` (visible on feed payloads, comments, etc.). An attacker can repeat step 3 to keep invalidating the victim’s pending nonce and **deny or disrupt** their API authentication. This is a denial-of-service on the auth bootstrap path, not a credential bypass.

Rotation after **successful** auth must still mint a new nonce (`authenticate` → consume → `mint` → `X-Next-Nonce`). Only the **public challenge route** must not clobber an existing pending nonce on behalf of a third party.

## Decision

Split nonce acquisition into two server paths:

| Call site                  | Function                    | Behaviour                                                                               |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `POST /api/auth/challenge` | `getOrMintAuthNonce(keyId)` | `GET auth:nonce:{keyId}`; return existing value if present and not near expiry, otherwise `SET` a new nonce |
| Successful `authenticate`  | `mintAuthNonce(keyId)`      | Always `SET` a fresh nonce for `X-Next-Nonce` (unchanged from ADR 0009)                 |

`AuthNonceStore` gains a read-only `get(keyId)` used by `getOrMintAuthNonce`. Consume semantics, wire format, and client caching in `feedApiAuth.ts` are unchanged except where noted below.

### TTL and near-expiry handling

- **`AUTH_NONCE_TTL_SECONDS`** reduced from 1 hour to **15 minutes** (server Redis `EX` and client `localStorage` cache).
- **`AUTH_NONCE_MIN_REMAINING_SECONDS`** = **30** — minimum usable lifetime before bootstrap remints or the client discards a cached nonce.
- **Problem:** challenge could return a nonce with only seconds left on its Redis TTL; signing and network latency then arrive after expiry → consume fails with **401**.
- **Server:** `getOrMintAuthNonce` checks remaining TTL (`TTL` on Redis). If fewer than 30 seconds remain, **mint a fresh nonce** instead of returning the dying one.
- **Challenge response:** `{ nonce, expiresAt }` where `expiresAt` is server Unix ms — client stores this in `localStorage` instead of assuming a full TTL from local clock.
- **Client:** `feedApiAuth.ts` drops cached nonces when `expiresAt - now < 30s` and fetches a new challenge before signing.

### Challenge + rotation (updated flow)

1. **Bootstrap:** `POST /api/auth/challenge` with `{ keyId }` → `{ nonce, expiresAt }`. First call mints; **repeat calls return the same nonce while it is unconsumed and not near expiry**.
2. **Authenticated request:** verify, consume, mint next nonce, set `X-Next-Nonce` (unchanged).
3. **Steady state:** client caches `X-Next-Nonce` — one round-trip per API call after bootstrap (unchanged).

`mint` still **replaces** when invoked explicitly (post-auth rotation). Challenge reuses a pending nonce when it has sufficient TTL; otherwise it mints fresh.

## Consequences

### Positive

- Third parties can no longer invalidate another user’s pending nonce by calling the open challenge endpoint with that user’s `keyId`.
- Aligns server behaviour with the public bootstrap contract: challenge is “give me the current pending nonce,” not “rotate this identity’s pending nonce.”
- Challenge responses include server-authoritative `expiresAt` so clients do not sign with nearly-expired nonces.
- No change to single-use consume, rotation, or signable v2 security — an attacker still cannot authenticate without the private key.

### Negative / limitations

- A stale unconsumed nonce can remain in Redis until TTL expiry or successful consume; challenge will keep returning it. That is intentional.
- An attacker can still **read** the current pending nonce for any `keyId` via challenge (unchanged from ADR 0009). That does not grant access; it only aids targeted interruption if combined with other timing — rate limiting remains a separate hardening option.

## Alternatives considered

### Always mint on challenge (status quo before this ADR)

- Simple, but lets any caller with a victim’s `keyId` replace that identity’s pending nonce and interrupt authentication.

### Require authentication on challenge

- Contradicts the bootstrap purpose — the client has no nonce yet with which to authenticate.

## References

- Tests: `apps/api/src/tests/authChallenge.test.ts`, `apps/api/src/tests/authNonce.test.ts`
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md)
