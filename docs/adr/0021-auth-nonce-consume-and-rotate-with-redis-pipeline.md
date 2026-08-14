# 0021. Auth nonce consume-and-rotate

- **Status:** Accepted
- **Date:** 2026-08-14
- **Expands:** [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0012](./0012-auth-nonce-consumed-before-route-validation.md)

## Context

[ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md) and [ADR 0012](./0012-auth-nonce-consumed-before-route-validation.md) define post-auth rotation: after a valid ECDSA proof, `authenticate` **consumes** the presented nonce from Redis and **mints** the next nonce for `X-Next-Nonce`.

The first implementation used two separate store calls:

1. `consume(keyId, nonce)` — Lua compare-and-delete (`EVAL`)
2. `mint(keyId)` — `SET` with `EX`, then `PTTL` for `expiresAtMs`

That is **three Redis round trips** per authenticated API request (one `EVAL` + one `SET` + one `PTTL`). Challenge bootstrap was already optimized atomically ([0013](./0013-atomic-get-or-mint-auth-challenge.md)); the authenticated hot path was not.

## Decision

### Atomic `consumeAndRotate`

Add **`consumeAndRotate(keyId, nonce)`** to `AuthNonceStore`. Returns a discriminated outcome:

| Outcome        | Redis state                              | `authenticate`                                                         |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **`rotated`**  | Presented nonce matched pending          | **200** + `X-Next-Nonce`                                               |
| **`minted`**   | No pending nonce (missing / expired key) | **401** + `X-Next-Nonce` (fresh mint for client recovery)              |
| **`mismatch`** | Different nonce pending                  | **401** + `X-Next-Nonce` (current pending nonce from Redis, unchanged) |

`authenticate` calls **`consumeAndRotateAuthNonce`** once instead of `consumeAuthNonce` + `mintAuthNonce`. Consume-before-route-validation semantics ([0012](./0012-auth-nonce-consumed-before-route-validation.md)) apply only on the **`rotated`** path — a **`minted`** outcome rejects the request but still stores a fresh nonce for the client (same recovery intent as `getOrMint` on challenge, [0010](./0010-challenge-reuses-pending-auth-nonce.md)).

#### Per-`keyId` single-use nonces (by design)

[ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md) keeps **one pending nonce per `keyId`**. Each successful rotation replaces it — a presented nonce is single-use. That is intentional replay protection, not a gap in `consumeAndRotate`.

If a client sends **two authenticated requests for the same `keyId` in parallel** with the **same cached nonce**, ECDSA may verify on both, but only one request **`rotated`**s; the other gets **`mismatch`** (401 + `X-Next-Nonce` with the current pending value). Different `keyIds` are independent. Clients serialize per key (`feedApiAuth.ts`: `withKeyAuthLock`, in-flight counting) or retry after 401 using `X-Next-Nonce`.

#### Redis — Lua script

One `EVAL` per rotation:

1. `GET` `auth:nonce:{keyId}`
2. If it equals the presented nonce, `SET` the next nonce and return `{ 1, nextNonce, ttlSeconds }` (**rotated**)
3. If the key is missing, `SET` a fresh nonce and return `{ 2, nextNonce, ttlSeconds }` (**minted**)
4. If a different nonce is pending, return `{ 3, currentNonce, pttlMs }` (**mismatch** — pending value unchanged)

The next nonce is generated in Node and passed as `ARGV`; the script sets it on successful consume or when no pending value exists. Rotation `expiresAtMs` is computed in Node as `Date.now() + AUTH_NONCE_TTL_SECONDS * 1000` (no `PTTL` read — the key was just set with a known `EX`).

`consume` and `mint` remain on the store for tests; production auth rotation uses `consumeAndRotate` only.

No request batching or pipeline queue: each rotation is a single direct `redis.eval()` call.

### Module layout

| File                  | Role                                      |
| --------------------- | ----------------------------------------- |
| `authNonceScripts.ts` | Shared Lua scripts, key helper, parsers   |
| `authNonceStore.ts`   | Redis and in-memory store implementations |

## Consequences

### Positive

- Authenticated request: **one Redis round trip** per rotation (was three).
- Simple implementation — no in-process queue, throttle, or flush coordination.
- Consume + rotate stays atomic per key — no window where the nonce is deleted but the next nonce is not yet set.
- Wire protocol and client caching unchanged (`X-Next-Nonce`, `X-Next-Nonce-Expires-At`, challenge bootstrap).

### Negative / limitations

- Many concurrent users each pay one Redis RTT per rotation independently; acceptable at current scale given measured cost vs handler/ECDSA work.
- **Production load:** if authenticated traffic grows large enough that Redis RTT becomes a bottleneck (many concurrent users per API replica finishing ECDSA verify in the same window), revisit **batching** `consumeAndRotate` calls — e.g. an in-process queue flushed via `redis.multi().execAsPipeline()` with multiple `EVAL`s in one network round trip. Not implemented now; measure in production before adding queue/throttle complexity (see rejected alternative below).

## Alternatives considered

### Keep separate `consume` + `mint`

- Correct semantics but three RTTs per auth; rejected.

### Optional Redis pipeline batching (`multi().execAsPipeline()` + throttle)

- Queue rotations and flush batches of `CONSUME_AND_ROTATE_NONCE_SCRIPT` `EVAL`s through `redis.multi().execAsPipeline()` (one RTT for N different `keyIds`). Optional throttle window to coalesce staggered completions after ECDSA verify.
- Prototyped with an in-process queue and `lodash.throttle`; load testing at current scale showed marginal Redis savings vs added coordination code. **Deferred** — reconsider if production metrics show Redis nonce rotation as a top cost under high concurrent-user load.

### Rely on `node-redis` automatic pipelining only

- Concurrent in-flight `eval()` on one connection may be pipelined by the client; no explicit batching layer required.

### In-process nonce cache on API workers

- Does not remove the consume round trip; stale cache across replicas; deferred.

### HTTP batch endpoint + nonce window (same user)

- Targets bulk same-user sync, not many concurrent users; out of scope.

## References

- Code: `apps/api/src/contexts/auth/infrastructure/authNonceScripts.ts`, `apps/api/src/contexts/auth/infrastructure/authNonceStore.ts`, `apps/api/src/middleware/authenticate.ts`
- Tests: `apps/api/src/tests/authNonce.test.ts` (`consumeAndRotate`)
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0012](./0012-auth-nonce-consumed-before-route-validation.md), [0013](./0013-atomic-get-or-mint-auth-challenge.md)
