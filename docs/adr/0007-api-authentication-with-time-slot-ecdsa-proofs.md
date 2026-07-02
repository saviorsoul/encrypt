# 0007. API authentication with time-slot ECDSA proofs

- **Status:** Accepted
- **Date:** 2026-07-02

## Context

The feed API (`apps/api`) previously trusted caller-supplied `keyId` values in query strings and request bodies. Anyone who knew a registered thumbprint could read inboxes, mutate friendships, or register public keys without proving private-key possession.

We want **one identity primitive**: the user's EC P-256 private key JWK, already used for manifest encryption and `senderSignature` on payloads. feed-lab is a **web** client; authentication must work through `fetch` and Web Crypto, not TLS client certificates or server-stored symmetric secrets.

## Decision

### Two layers, one private key

| Layer        | Signable                                                                      | Purpose                                      |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------- |
| **API auth** | GET: `{ v, keyId, method, path, query, timeSlot }`; POST/DELETE: + `bodyHash` | Prove who is calling and which request       |
| **Payload**  | Existing manifest / share / comment bodies                                    | Prove who encrypted or signed the ciphertext |

`timeSlot = floor(unix_seconds / 30)`. The client sends:

```
X-Key-Id, X-Public-Key, X-Time-Slot, X-Signature
```

`X-Public-Key` is the EC P-256 coordinates in wire form (`x;y`, same as user registration). The server accepts `timeSlot` within ±1 slot of its clock, **derives the expected `keyId` thumbprint from `X-Public-Key`**, and verifies ECDSA P-256 / SHA-256 over the canonical JSON signable (same `serializeForSigning` as manifests). **No database lookup runs in `authenticate`** — identity is proved cryptographically from the headers alone.

The auth signable binds the proof to the HTTP request. **GET** and other bodyless verbs omit `bodyHash`; **POST** and **DELETE** include it:

| Verbs                             | Signable fields                                                    |
| --------------------------------- | ------------------------------------------------------------------ |
| `GET` (and other non-POST/DELETE) | `v`, `keyId`, `method`, `path`, `query`, `timeSlot`                |
| `POST`, `DELETE`                  | above + `bodyHash` (SHA-256 base64 of `serializeForSigning(body)`) |

The same **GET** URL in the same time slot produces the **same signature** for 30 seconds (client cache reuse; private HTTP cache friendly).

### Weaker GET auth (accepted tradeoff)

**GET authentication is deliberately less strict than POST/DELETE.**

| GET auth gap                | What it means                                                             |
| --------------------------- | ------------------------------------------------------------------------- |
| No `bodyHash`               | Bodyless reads are not bound to a request body (N/A for GET)              |
| Reusable signature per slot | The same `GET` URL + auth headers can be replayed within ~30 seconds      |
| Cross-endpoint replay       | A captured GET proof cannot be replayed on POST, but the **same** GET can |

We accept this because of how data is stored on the backend:

- **Message, share, and comment content is encrypted end-to-end.** The API stores ciphertext, key-manifest shards, and signatures — not plaintext.
- **Decrypting feed data requires the recipient's private key** (and the correct manifest shard). A caller who passes GET auth but lacks the private key gains no readable content.
- **Mutations that change trust or state** (send message, share, comment, friendship changes, registration) use **POST/DELETE** with full `bodyHash` binding and, where applicable, payload `senderSignature` / `sharerSignature`.

GET auth therefore gates **who may fetch metadata** (inbox rows, friendship lists, public key directory, comment ciphertext blobs) — not **who may read plaintext**. Leaking a GET capability within a short window exposes encrypted blobs and social graph shape to an authenticated identity, not message content. Tightening GET to per-request nonces or body binding was rejected in favour of cache-friendly reads and simpler client signing, given the encryption model above.

### Server middleware

- `authenticate` — verify headers (keyId ↔ public key thumbprint + signature) against the incoming request shape and set `ctx.state.authenticatedKeyId`; **stateless, no DB**
- `authenticateApiUnlessPublic` — skip `GET /health` only
- `requireActor` — legacy helper for matching body/query actors; friendship and inbox reads now bind the actor from `authenticatedKeyId` directly
- `requireAuthenticatedSigner` — on encrypted writes, `senderPublicJwk` / `sharerPublicJwk` thumbprint must match authenticated `keyId`

`POST /api/users` requires auth. Self-registration (`authenticatedKeyId === derived keyId`) also runs `validateKeyIdPublicKeyPairOrThrow`. Registering another user's public key (feed-lab recipient directory) only requires any authenticated caller.

### Client (feed-lab)

- Reuse web app in-memory non-extractable key cache ([ADR 0002](./0002-in-memory-non-extractable-private-key-cache.md))
- `createFeedApi({ auth })` signs each request descriptor before `fetch`
- One-off registration after key generation passes `authMaterial` for `postUser` before session unlock

## Consequences

### Positive

- Private key is the single source of truth for API identity and payload signing
- No server session tokens, JWT secret, or `auth_nonces` table
- One round-trip per API call (no challenge mint endpoint)
- **Stateless API auth** — no Postgres read on every request; only crypto verification in `authenticate`
- Request-bound proofs block cross-endpoint replay within a time window; identical GETs in the same slot reuse one signature
- Reuses existing ECDSA verify stack on the API

### Negative / limitations

- **GET auth is weaker than POST/DELETE** — see [Weaker GET auth](#weaker-get-auth-accepted-tradeoff); acceptable because backend payload is ciphertext
- Replay of the **same** GET within ~30s is possible (mitigated by short window)
- Clock skew requires accepting `timeSlot ± 1`
- Each distinct **POST/DELETE** requires its own signature (GET repeats in the same slot reuse the cache)
- `bodyHash` is computed from parsed JSON — client and server must serialize the body the same way
- `GET /api/comments` is authenticated but not scoped to a specific actor (any logged-in key holder with a `messageId` can read)
- First-time flows that call the API without unlocking identity fail until the user picks a key (except generate-user, which signs with the new key inline)

## Alternatives considered

### Server-minted nonce per request

Strongest single-use replay protection, but two round-trips per call and a nonce store. Rejected for v1 UX.

### Time-slot only signable (`{ keyId, timeSlot }`)

Simpler client (one signature per window), but a captured proof works on any endpoint for ~30s. Superseded by request-bound signable.

### HMAC / TOTP with server-stored symmetric `authKey`

Faster client ops possible, but stores secrets in Postgres and breaks public-key-only server model.

## References

- Related ADRs: [0002](./0002-in-memory-non-extractable-private-key-cache.md)
