# 0012. Auth nonce consumed before route validation

- **Status:** Accepted
- **Date:** 2026-07-04
- **Expands:** [0009](./0009-api-authentication-with-server-minted-redis-nonces.md)

## Context

[ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md) places `authenticate` on all `/api` routes (except public bootstrap and health). The middleware verifies the v2 ECDSA proof, **consumes the nonce**, mints the next nonce (`X-Next-Nonce`), then calls `next()`.

Per-route middleware — `validateBody`, `requireAuthenticatedSigner`, `verifySignature`, and handlers — runs **after** `authenticate`. A request can therefore pass cryptographic authentication and still fail with **400** (schema), **403** (signer binding), or **500** (handler error).

It is not obvious whether the nonce should be consumed only when the handler succeeds, or as soon as the proof is valid.

## Decision

**Consume the nonce immediately after a valid proof**, before route validation and the handler. Rotation (`X-Next-Nonce` / `X-Next-Nonce-Expires-At`) happens at the same point.

Order inside `authenticate`:

1. Validate auth headers and `timeSlot`
2. Verify ECDSA signature over the signable (method, path, query, `bodyHash` when applicable, `nonce`)
3. **Consume nonce** from Redis (atomic compare-and-delete)
4. **Mint** next nonce and set response headers
5. `await next()` — route middleware and handler

This is **intentional replay protection**: a captured `{ headers, body }` pair cannot be submitted again even if the first attempt was rejected by business rules. The signature and nonce together constitute a single-use capability for that exact request descriptor.

### Client implications

- Responses may include `X-Next-Nonce` even when the status is **4xx** or **5xx** after auth passed (e.g. invalid JSON schema, signer mismatch). The client must capture the rotated nonce and **re-sign** on retry; it cannot replay the same signed request.
- `feedApi` already retries once on **401** with a fresh nonce; other failures after rotation require the client to use the new pending nonce from the response headers.

### What this does not do

- Failed **authentication** (bad signature, wrong nonce, expired slot) does **not** consume the nonce — consume runs only after `verifyAuthProof` succeeds.
- This does not replace payload `senderSignature` verification on encrypted routes; both layers apply where configured.

## Consequences

### Positive

- Intercepted signed requests cannot be replayed after the first cryptographically valid delivery, even if the server rejected the payload.
- Clear single-use semantics aligned with server-minted nonces.

### Negative / limitations

- A valid proof spent on a client bug (malformed body) still advances the nonce chain — the caller must re-sign.
- Operators debugging **400** responses should expect the nonce to be spent; use a new nonce from response headers or challenge.

## Alternatives considered

### Consume only after successful handler (2xx)

- Would let clients retry the **same** signed request after a validation error — reopens single-use replay for identical request replays until the handler succeeds.

### Consume after route `validateBody` but before handler

- Narrower replay window, but a valid proof over a bad body could still be replayed if schema validation is the only failure; rejected for weaker guarantees.

## References

- Code: `apps/api/src/middleware/authenticate.ts`, `apps/api/src/middleware/authenticateApiUnlessPublic.ts`
- Related ADRs: [0009](./0009-api-authentication-with-server-minted-redis-nonces.md), [0011](./0011-auth-nonce-expires-at-on-rotation.md)
