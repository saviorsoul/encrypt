# 0019. Feed-lab bridge: selective confirmation after pairing

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

[ADR 0018](./0018-feed-lab-bridge-via-encrypt-protocol.md) requires **user confirmation in the Encrypt system app for every `feed-op`** before any oracle runs. That mirrors feed-lab’s `SignNetworkRequestProvider` when the private key is loaded in-browser.

**Scope:** This ADR applies only when the protocol bridge is enabled (`VITE_FEED_LAB_PROTOCOL_BRIDGE=true`). With the flag off (default), feed-lab does not open `encrypt://feed-pair` / `feed-op` and users load a private key file instead ([0018](./0018-feed-lab-bridge-via-encrypt-protocol.md) §8).

With the bridge enabled, each API call that needs auth headers triggers:

1. feed-lab opens `encrypt://feed-op` (OS context switch)
2. Encrypt app shows a confirmation dialog
3. Encrypt app signs and opens the callback URL (another context switch)
4. feed-lab resumes the HTTP request

Feed browsing is read-heavy: inbox lists, friendship state, public keys, comment ciphertext blobs, and decrypt prep all issue many **GET** requests. Each one currently forces a confirmation dialog even though the user already approved pairing (`feed-pair`) for that browser origin and bridge session.

Pairing is the high-trust gate: the user explicitly connects a specific feed-lab origin to their Encrypt identity. After that, we can distinguish **low-risk read signing** from **mutations and decryption** that deserve per-action review.

### Related auth properties

- API auth signables bind `method`, `path`, `query`, `timeSlot`, and `nonce` ([ADR 0009](./0009-api-authentication-with-server-minted-redis-nonces.md)).
- **GET** proofs omit `bodyHash`; **POST** and **DELETE** include it.
- Nonces are single-use per `keyId`; replay of a captured GET proof fails after the first consume ([ADR 0012](./0012-auth-nonce-consumed-before-route-validation.md)).
- GET auth gates **metadata and ciphertext fetch**, not plaintext decryption ([ADR 0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md) — weaker GET auth accepted because payloads are encrypted).

## Decision

### 1. Pairing always requires confirmation

`feed-pair` continues to show an origin-approval dialog. No change.

Disconnecting (feed-lab tab close/refresh, explicit disconnect, Encrypt logout, or key mismatch) ends the bridge session; the user must pair again.

### 2. After pairing, confirm only selected `feed-op` actions

Once a `feed-pair` session is approved for an origin, the Encrypt app **may auto-execute** certain `feed-op` oracles without showing a confirmation dialog.

Classification is by **oracle op** and **decoded payload**, not by URL shape alone.

| Oracle | Auto without dialog (phase 1) | Still requires confirmation |
| ------ | ----------------------------- | ----------------------------- |
| `op-quick` | Strict `api-auth-get` JSON payload (GET `/api/…` auth only) | Invalid or unknown quick-op payloads |
| `ecdsa-sign` | — | All `ecdsa-sign` (POST/DELETE API auth, manifest signatures, …) |
| `ecdh-agree` | — (phase 1) | All `ecdh-agree` calls (unlocks local decrypt of fetched ciphertext) |

**Phase 1 scope:** feed-lab uses **`op-quick`** for GET API auth. The Encrypt app auto-executes `op-quick` only when the payload passes strict JSON validation. All `ecdsa-sign` and `ecdh-agree` ops keep the confirmation dialog.

### 3. `op-quick` payload format and validation

GET API auth uses a dedicated oracle op with a versioned, discriminated JSON envelope in [`feedLabBridgeQuickOp.ts`](../../packages/core/src/feed/feedLabBridgeQuickOp.ts):

```json
{
  "v": 1,
  "kind": "api-auth-get",
  "auth": {
    "v": 2,
    "keyId": "…",
    "method": "GET",
    "path": "/api/inbox",
    "query": null,
    "timeSlot": 12345,
    "nonce": "…"
  }
}
```

Validation is **structural**, not inferred from a loose `signable` record:

- Root object has **exactly** `v`, `kind`, `auth` (no extra keys)
- `kind` must be a registered quick-op type (`api-auth-get` in phase 1)
- `auth` has **exactly** the API auth GET signable fields (no `bodyHash`, no smuggled keys)
- `method` must be **`GET`**; `path` must match `/api/…`
- `nonce` and `timeSlot` are validated with the same helpers as server auth ([`parseAuthNonceHeader`](../../packages/core/src/crypto/authProof.ts), [`isAuthTimeSlotAccepted`](../../packages/core/src/crypto/authProof.ts))
- At execution time, `auth.keyId` must match the paired Encrypt identity

New quick-op kinds are added by extending `FeedLabBridgeQuickOpKind`, registering a parser in `QUICK_OP_PARSERS`, and deciding auto-approval policy per kind.

`ecdsa-sign` is no longer auto-approved; only explicitly structured `op-quick` payloads qualify.

### 4. Auto-approved ops still use the full bridge path

Auto-approval **only skips the confirmation UI**. It does **not**:

- skip session binding (`approvedSessions`, `session.keyId` mismatch checks)
- skip bridge session encryption of oracle results
- skip opening the callback URL (OS context switch remains for now)

Background `op-quick` additionally **must not foreground the Encrypt app** when the window was hidden:

| Platform | Behaviour |
| -------- | --------- |
| **Electron** | Hidden tray window keeps processing with `backgroundThrottling: false`; renderer calls `showMainWindow` when login/confirm is needed; after silent success, hide again only if the window was not already visible |
| **Android (Capacitor)** | OS still briefly foregrounds on `encrypt://`; after callback opens in the referring browser, `moveTaskToBack(true)` returns the user to feed-lab |
| **iOS (Capacitor)** | No reliable background custom-scheme handling; user may see a brief app switch (documented limitation) |

When the Encrypt app is not signed in (or keys are not ready), `op-quick` **foregrounds the app** and queues the request until login completes — it does not fail silently in a hidden window.

Future work may batch or coalesce GET auth oracles; that is out of scope for phase 1.

Bridge **op** callbacks request a background browser open when the OS supports it (Electron `shell.openExternal({ activate: false })` on macOS). The callback tab writes its result and closes immediately so focus often returns to the feed-lab tab.

### 5. feed-lab in-browser signing unchanged

When the user loads a private key via file picker (non-bridge mode), `SignNetworkRequestProvider` behaviour is unchanged. This ADR applies only to **Encrypt app bridge** `feed-op` handling.

## Consequences

### Positive

- Dramatically fewer confirmation dialogs while browsing feed-lab with a paired Encrypt app
- Pairing remains the explicit trust decision for origin + identity
- GET auto-sign is bounded: signable binds method/path/query/nonce; mutations still require per-action confirmation
- Aligns bridge UX with the accepted weaker GET auth model (metadata reads vs writes)

### Negative / limitations

- **Malicious feed-lab origin after pairing** could trigger unlimited GET auth signatures without further prompts until the user disconnects. Mitigations: pairing is origin-scoped; GET proofs are nonce-single-use; responses are ciphertext/metadata only.
- **OS context switch per GET** may remain (auto-sign does not remove `encrypt://` round-trip in phase 1).
- **`ecdh-agree` still confirms** — decrypting a thread may still feel heavy until a later phase addresses decrypt oracle policy.
- Users cannot opt into “confirm every GET” without a future setting (not in phase 1).

## Alternatives considered

### Keep confirming every `feed-op`

- Safest UX; rejected — too disruptive for normal feed browsing.

### Auto-approve all `ecdsa-sign` (including POST/DELETE)

- Rejected for phase 1 — writes (send message, accept friendship, post comment) should stay explicit.

### Auto-approve all oracles after pairing

- Rejected — `ecdh-agree` directly enables decrypting content the user may not have reviewed.

### Time-limited “trust this session for 15 minutes” blanket grant

- Rejected for phase 1 — harder to reason about than per-action-type rules; can revisit if GET-only auto-sign is insufficient.

## Implementation notes (phase 1)

- Protocol bridge must be enabled (`VITE_FEED_LAB_PROTOCOL_BRIDGE=true`) for any of the behaviour below to be reachable
- [`feedLabBridgeQuickOp.ts`](../../packages/core/src/feed/feedLabBridgeQuickOp.ts) — strict payload types, parsers, and `buildFeedLabBridgeQuickOpApiAuthGetPayload`
- [`externalFeedApiAuth.ts`](../../packages/core/src/api/externalFeedApiAuth.ts) — GET auth uses `op-quick`; POST/DELETE use `ecdsa-sign`
- [`feedLabBridgeOracles.ts`](../../packages/core/src/feed/feedLabBridgeOracles.ts) — `op-quick` validates then signs
- [`FeedLabBridgeHandler.tsx`](../../apps/web/src/components/providers/FeedLabBridgeHandler.tsx) — auto-executes validated `op-quick` for paired sessions

Auto-approval requires a paired session with a known `keyId` in `approvedSessions`.

## References

- Code:
  - [`packages/core/src/feed/feedLabBridgeQuickOp.ts`](../../packages/core/src/feed/feedLabBridgeQuickOp.ts)
  - [`apps/web/src/components/providers/FeedLabBridgeHandler.tsx`](../../apps/web/src/components/providers/FeedLabBridgeHandler.tsx)
  - [`apps/web/src/components/providers/FeedLabBridgeConfirmDialog.tsx`](../../apps/web/src/components/providers/FeedLabBridgeConfirmDialog.tsx)
  - [`packages/core/src/crypto/authProof.ts`](../../packages/core/src/crypto/authProof.ts)
  - [`packages/core/src/api/externalFeedApiAuth.ts`](../../packages/core/src/api/externalFeedApiAuth.ts)
- Related ADRs:
  - [0018](./0018-feed-lab-bridge-via-encrypt-protocol.md) — bridge protocol, feature flag (`VITE_FEED_LAB_PROTOCOL_BRIDGE`, default off), and confirmation rules
  - [0009](./0009-api-authentication-with-server-minted-redis-nonces.md) — signable v2 and nonce semantics
  - [0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md) — weaker GET auth tradeoff
