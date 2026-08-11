# 0018. Feed-lab bridge via `encrypt://` protocol and same-origin callback

- **Status:** Accepted
- **Date:** 2026-08-08

## Context

[feed-lab](../../apps/feed-lab/) is a static web client (GCS + `HashRouter` in production) that signs API requests and encrypted payloads with a private key loaded via browser file picker. Users want to use the **Encrypt system app** (Electron desktop, Capacitor mobile) as the sole holder of the private key while feed-lab runs in an **external browser tab**.

[ADR 0015](./0015-browser-integration-via-encrypt-protocol.md) established `encrypt://` for one-way extension → desktop flows (encrypt, decrypt, copy-public-key). Feed-lab needs a **request/response** channel for:

- API auth proofs (`X-Signature` headers; nonce lifecycle stays in feed-lab `localStorage`)
- Payload encrypt/sign/decrypt (`encryptWithManifest`, shares, comments)

Loopback HTTP was rejected in ADR 0015 for the extension MVP. Feed-lab uses a **callback URL** on the same origin instead.

## Decision

### 1. Extend `encrypt://` with feed-lab bridge actions

| URL | Purpose |
| --- | ------- |
| `encrypt://feed-pair?origin=…&session=…&callback=…&bridgeSessionKeyId=…&bridgeSessionPublicJwk=…` | Pair browser origin with system app session |
| `encrypt://feed-op?session=…&requestId=…&op=…&payload=…&bridgeSessionKeyId=…&bridgeSessionPublicJwk=…` | Request a signing/ECDH oracle (`payload` = base64url JSON) |

Parsing lives in [`apps/web/electron/deepLinks.js`](../../apps/web/electron/deepLinks.js) and shared helpers in [`packages/core/src/feed/feedLabBridge.ts`](../../packages/core/src/feed/feedLabBridge.ts).

### 2. Return channel: same-origin callback + `localStorage` event

After user confirms in the system app, the app opens the feed-lab callback URL in the default browser:

```
https://feed.example.com/#/bridge-callback?requestId=…&record=…
```

`record` is a base64url JSON `FeedBridgeEncryptedStorageRecord` (`sessionKeyId`, optional `envelope`, optional `error`). The callback route writes `encrypt:bridge-result:{requestId}` to `localStorage`. The originating feed-lab tab listens via the `storage` event (same pattern as auth nonce sync in ADR 0009).

### 3. Nonce ownership

feed-lab retains challenge fetch, `X-Next-Nonce` capture, and per-`keyId` mutex. The system app receives a canonical `signable` object via `ecdsa-sign` and returns only the signature.

### 4. Thin oracles in the system app; symmetric crypto in feed-lab

The Encrypt app exposes two oracles only:

| Op | System app | feed-lab |
| --- | --- | --- |
| `ecdh-agree` | Derive ECDH shared secret with paired private key | Uses secret to unwrap manifest DEKs and decrypt locally |
| `ecdsa-sign` | Sign canonical body with paired private key | Builds manifests/comments locally; verifies decrypt paths locally |

Oracle results are encrypted to a per-tab **bridge session** public key (ECDH + AES-GCM ephemeral envelope) before crossing the callback URL / `localStorage`.

### 5. Bridge session key lifecycle

- feed-lab generates a per-tab **non-extractable** ECDH keypair in memory when pairing starts (ADR 0002 pattern: brief JWK import, then discard bytes).
- The bridge session **private key is never written** to `sessionStorage`, `localStorage`, or IndexedDB.
- Pairing metadata (Encrypt app `sessionId`, `keyId`, bridge session public key) is held **in memory only**, bound to the same bridge session private key established during `feed-pair`.
- Losing the in-memory bridge private key (page refresh, tab close, disconnect) **ends the session**; the user must run `feed-pair` again. Pairing metadata is not silently updated for a new bridge key.
- Callback / bridge-result `localStorage` entries include `sessionKeyId` so logout or session rotation can purge stale records.
- Ephemeral cross-tab pairing completion uses `localStorage` (`encrypt:bridge-pending-pair:{sessionId}`) only as a transport from the callback tab.

### 6. User confirmation

Every `feed-op` shows an in-app confirmation dialog before crypto runs (mirrors feed-lab `SignNetworkRequestProvider`). `feed-pair` shows an origin approval dialog once per pairing.

### 7. `shell:open-external` hardening (Electron)

Feed Lab bridge callbacks are opened via `shell.openExternal` in the Electron main process. Guards:

- IPC sender must be the trusted main window (`assertPrivateKeyIpcSender`)
- Only `http:` / `https:` URLs (no `file:`, custom schemes, or embedded credentials)
- Hostname must match **`VITE_FEED_LAB_HOSTNAME`** (default `feednt.com`, `https` only) or **`VITE_FEED_LAB_DEV_HOSTNAME`** (default `localhost`, `http` only)
- When **`VITE_FEED_LAB_HASH_ROUTER=true`** (default), production-host callbacks must use hash routes (`#/bridge-callback`); dev host uses pathname routes
- `encrypt://feed-pair` rejects callbacks whose origin does not match the `origin` param (validated in `deepLinks.js` and again before opening)

Validation lives in [`feedLabBridgeConfig.ts`](../../packages/core/src/feed/feedLabBridgeConfig.ts), [`feedLabBridgeOpenExternal.ts`](../../packages/core/src/feed/feedLabBridgeOpenExternal.ts) (renderer), and [`feedLabBridgeOpenExternal.js`](../../apps/web/electron/feedLabBridgeOpenExternal.js) (main / deep-link parser). Configure via `VITE_FEED_LAB_HOSTNAME`, `VITE_FEED_LAB_DEV_HOSTNAME`, and `VITE_FEED_LAB_HASH_ROUTER` in repo-root `.env`.

### 8. Protocol bridge feature flag (default off)

The feed-lab **protocol bridge** (`encrypt://feed-pair`, `encrypt://feed-op`, callback handling in the system app) is gated by **`VITE_FEED_LAB_PROTOCOL_BRIDGE`**. It defaults to **disabled** (`false` when unset).

Rationale: programmatic `encrypt://` handoff is a broader OS attack surface than loading a private key file in the browser or clipboard-based extension flows ([ADR 0015](./0015-browser-integration-via-encrypt-protocol.md)). Ship the implementation without enabling it until operators explicitly opt in.

When disabled:

| Surface | Behaviour |
| ------- | --------- |
| **feed-lab** | No “Connect Encrypt app” UI; `pairWithSystemApp` / `requestBridgeOracle` reject; users sign in with a private key file |
| **Electron main** | `encrypt://feed-pair` and `encrypt://feed-op` deep links are rejected with a clear error |
| **Electron / Capacitor renderer** | `FeedLabBridgeHandler` is not mounted |

Other `encrypt://` actions from the browser extension (`encrypt`, `decrypt`, `copy-public-key`) are unaffected.

Enable for local or staged testing:

```env
VITE_FEED_LAB_PROTOCOL_BRIDGE=true
```

Flag is read in [`feedLabBridgeConfig.ts`](../../packages/core/src/feed/feedLabBridgeConfig.ts) (shared) and [`feedLabBridgeConfig.js`](../../apps/web/electron/feedLabBridgeConfig.js) (Electron main). Documented in repo-root [`.env.example`](../../.env.example).

## Consequences

### Positive

- Reuses OS `encrypt://` handler registration from ADR 0015
- No loopback HTTP server or pairing tokens on localhost
- Private keys remain in system app secure storage; shared secrets and signatures are session-encrypted in transit
- feed-lab performs bulk symmetric crypto locally (fewer round-trips than fat payload ops)
- `sessionKeyId` tagging enables targeted `localStorage` cleanup on logout

### Negative / limitations

- **OS context switch** per oracle call (browser → app → browser); decrypting a thread may require multiple `ecdh-agree` hops
- **URL size limits** on `feed-op` payloads (~32 KiB JSON)
- **Callback tab** may flash briefly in the browser
- **Mobile** requires `encrypt://` intent-filter / URL scheme registration
- **Page refresh** ends the browser↔Encrypt bridge session; users must re-pair with the Encrypt app
- Pairing is per browser tab lifetime; opening a new tab or clearing site data requires re-pairing
- **Protocol bridge disabled by default** — production builds do not expose feed-lab ↔ system-app `encrypt://` bridge until `VITE_FEED_LAB_PROTOCOL_BRIDGE=true`

## Alternatives considered

### Loopback HTTP in Electron main

- Viable for large payloads; rejected for MVP to avoid new local control surface (ADR 0015 rationale)

### Embed feed-lab in Electron/Capacitor WebView

- Simpler (`window.electron` / `window.capacitorBridge`); rejected — product requirement is external browser for **feed-lab**
- **Feednt** ([ADR 0020](./0020-feednt-standalone-native-app.md)) is a separate native product that holds keys in-app and does not use the bridge; the external-browser constraint does not apply there

### Fat payload ops in the system app (`encrypt-message`, `decrypt-message`, …)

- Initial implementation; superseded by thin oracles + local symmetric crypto to reduce round-trips and keep ciphertext handling in feed-lab

## Changes

### 2026-08-10 — Protocol bridge feature flag

| Topic | As accepted | Current |
| ----- | ----------- | ------- |
| Protocol bridge availability | Implemented and reachable via `encrypt://feed-pair` / `feed-op` | Gated by **`VITE_FEED_LAB_PROTOCOL_BRIDGE`**; **off by default** (see §8) |

### 2026-08-10 — [0019](./0019-feed-lab-bridge-selective-confirmation.md)

| Topic | As accepted | Current |
| ----- | ----------- | ------- |
| `feed-op` confirmation | Every `feed-op` shows a confirmation dialog before crypto runs | After `feed-pair`, validated **`op-quick`** (`api-auth-get`) may run without a dialog; `ecdsa-sign`, `ecdh-agree`, and invalid quick payloads still confirm |

### 2026-08-08

Refined the bridge from fat payload operations to **thin oracles** (`ecdh-agree`, `ecdsa-sign`) with **session-encrypted** callback records:

- Added [`feedLabBridgeSessionCrypto.ts`](../../packages/core/src/feed/feedLabBridgeSessionCrypto.ts) for bridge session envelopes.
- Added [`feedLabBridgeOracles.ts`](../../packages/core/src/feed/feedLabBridgeOracles.ts) (app-side signing/ECDH only).
- Added [`feedLabBridgeClientCrypto.ts`](../../packages/core/src/feed/feedLabBridgeClientCrypto.ts) (feed-lab-side encrypt/decrypt using oracle callbacks).
- Removed [`feedLabBridgeOps.ts`](../../packages/core/src/feed/feedLabBridgeOps.ts) (fat ops).
- Callback query param is now `record` (encrypted storage shape) instead of cleartext `result`.

Threat model notes:

- Unauthenticated plaintext in callback URLs is avoided for oracle outputs (session encryption).
- Shared secrets are scoped to the manifest ephemeral key for each `ecdh-agree` call.
- `sessionKeyId` on `localStorage` records limits blast radius on logout / key rotation.

## References

- Code:
  - [`packages/core/src/feed/feedLabBridge.ts`](../../packages/core/src/feed/feedLabBridge.ts)
  - [`packages/core/src/feed/feedLabBridgeOracles.ts`](../../packages/core/src/feed/feedLabBridgeOracles.ts)
  - [`packages/core/src/feed/feedLabBridgeClientCrypto.ts`](../../packages/core/src/feed/feedLabBridgeClientCrypto.ts)
  - [`packages/core/src/feed/feedLabBridgeSessionCrypto.ts`](../../packages/core/src/feed/feedLabBridgeSessionCrypto.ts)
  - [`apps/feed-lab/src/crypto/systemAppSigner.ts`](../../apps/feed-lab/src/crypto/systemAppSigner.ts)
  - [`apps/feed-lab/src/crypto/systemAppBridgeClient.ts`](../../apps/feed-lab/src/crypto/systemAppBridgeClient.ts)
  - [`packages/core/src/feed/feedLabBridgeConfig.ts`](../../packages/core/src/feed/feedLabBridgeConfig.ts)
  - [`packages/core/src/feed/feedLabBridgeOpenExternal.ts`](../../packages/core/src/feed/feedLabBridgeOpenExternal.ts)
  - [`apps/web/electron/feedLabBridgeOpenExternal.js`](../../apps/web/electron/feedLabBridgeOpenExternal.js)
  - [`apps/web/src/components/providers/FeedLabBridgeHandler.tsx`](../../apps/web/src/components/providers/FeedLabBridgeHandler.tsx)
- Related ADRs:
  - [0015](./0015-browser-integration-via-encrypt-protocol.md)
  - [0009](./0009-api-authentication-with-server-minted-redis-nonces.md)
