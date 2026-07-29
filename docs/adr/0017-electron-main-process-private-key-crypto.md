# 0017. Electron main-process private key crypto

- **Status:** Postponed
- **Date:** 2026-07-29

## Context

The Electron desktop build persists private keys with OS-backed `safeStorage` ([ADR 0016](./0016-electron-safe-storage-private-key-persistence.md)) and performs all private-key cryptography in the **renderer** using Web Crypto:

1. Main decrypts the stored JWK and returns **plaintext JWK text** over IPC (`private-key:safe-storage:load`).
2. Renderer imports the JWK into **non-extractable** `CryptoKey` objects ([ADR 0002](./0002-in-memory-non-extractable-private-key-cache.md)).
3. Application code calls `crypto.subtle.sign`, `deriveBits`, and related APIs via `UploadedPrivateKeyMaterial` and `@encrypt/core`.

Main already owns privileged I/O ([ADR 0004](./0004-main-process-owns-external-file-reads.md)), but **crypto stays in the lower-trust renderer**. A proposed hardening direction is to move private-key handling entirely to the **main process**: load from `safeStorage` in main, keep the secret in Node, and expose only **operation-level IPC** (sign, derive, decrypt) — never raw JWK to the renderer.

This would reduce IPC that carries plaintext private key material and keep key bytes out of the Chromium process address space. It is a **large refactor** touching `@encrypt/core`, web-adjacent hooks, tray/deep-link encrypt paths, and feed-lab parity. We document the idea here and **postpone** it in favour of lighter hardening first (e.g. session-locked keychain IPC in [ADR 0016](./0016-electron-safe-storage-private-key-persistence.md)).

## Decision

**Postpone** moving Electron private-key crypto to the main process. Implement lighter hardening first; revisit when a future threat model or platform requirement (e.g. TPM/HSM) justifies the refactor cost.

Current architecture remains: renderer Web Crypto with non-extractable `CryptoKey`s, `safeStorage` as persistence, optional in-memory session cache on desktop.

## Potential security improvements (why it was considered)

| Improvement | Description |
| ----------- | ----------- |
| **No plaintext JWK over IPC** | Today, warmup and cache-miss paths send decrypted JWK text from main to renderer. Main-process crypto eliminates that channel entirely. |
| **Key material not in renderer memory** | Non-extractable `CryptoKey`s still live in the Chromium process; crash dumps and memory forensics target that process. The private scalar would reside only in main/Node. |
| **Process boundary** | Renderer compromise does not automatically expose Node's address space; attacker must abuse IPC handlers instead of calling `crypto.subtle` directly. |
| **Semantic policy choke point** | Main can validate operation shape before signing or deriving (challenge format, app ciphertext structure, bound `keyId`, rate limits) — if IPC is designed narrowly, not as generic `sign(hash)`. |
| **Path to hardware-backed keys** | TPM, secure enclave, or HSM integration fits main/Node more naturally than Web Crypto in the renderer. |

These are **real but incremental** gains relative to non-extractable renderer keys plus session-locked keychain IPC. They do not remove operational abuse by compromised renderer JS unless IPC is strictly semantic.

## Pros

- **Eliminates plaintext private key IPC** — strongest isolation story for “secret never enters renderer.”
- **Smaller renderer trusted computing base** for key material — UI and dependencies no longer hold `CryptoKey` handles or interceptable `UploadedPrivateKeyMaterial`.
- **Aligns persistence and crypto in one process** — `safeStorage` load, hold, and use without round-tripping JWK to the renderer.
- **Audit and rate-limit surface** — sensitive operations funnel through a small set of main handlers.
- **Future-proof for stronger storage** — native modules and platform secure stores attach to main, not Chromium.
- **Reduces dependency hooking risk** — malicious renderer packages cannot wrap in-process `crypto.subtle` or `withUploadedPrivateKey` around a live key object.

## Cons

- **Huge refactor** — private-key paths span `packages/core`, `apps/web` (encrypt/decrypt hooks, tray, deep links, one-to-one, manifests, comments), and `apps/feed-lab`; Electron and web builds diverge or need dual implementations.
- **Modest gain vs renderer XSS** — if IPC exposes generic sign/derive/decrypt, a compromised renderer has similar operational power to today’s non-extractable `CryptoKey`s (`exportKey` is already blocked).
- **Plaintext still crosses IPC** for many flows unless main owns full encrypt/decrypt pipelines (ciphertext in, plaintext out).
- **Main becomes high-value target** — bugs in IPC handlers are as critical as renderer key leaks; main joins the TCB for every crypto operation.
- **Latency and complexity** — every private-key op pays IPC + Node `crypto`; batch decrypt and tray paths need careful design.
- **Web/Electron parity** — browser build must keep renderer Web Crypto; shared `@encrypt/core` abstractions need an Electron-specific backend or forked call sites.
- **Testing burden** — crypto correctness, IPC contracts, and regression coverage across platforms multiply.
- **Session-locked keychain is cheaper** — blocking post-warmup `load` / `store` / `clear-all` captures most “no JWK exfiltration” benefit without relocating crypto.

## Alternatives considered

### Keep renderer Web Crypto (current)

- Non-extractable `CryptoKey`s; `safeStorage` for persistence; in-memory session cache on Electron.
- **Accepted** as the baseline ([ADR 0016](./0016-electron-safe-storage-private-key-persistence.md)).

### Session-locked keychain IPC (proposed)

- After login warmup, main rejects keychain `load` / `store` / `clear-all` from renderer; crypto uses cached `CryptoKey`s only.
- **Preferred next step** — lower cost, closes plaintext JWK IPC after unlock without moving crypto ([ADR 0016](./0016-electron-safe-storage-private-key-persistence.md)).

### Main-process crypto (this ADR)

- Main holds key; renderer calls semantic or primitive IPC for ops only.
- **Postponed** — disproportionate scope for now; revisit for HSM/TPM or stricter renderer memory isolation requirements.

## Consequences

### Positive (of documenting postponement)

- Future contributors understand why crypto remains in the renderer and what a main-process migration would entail.
- Security discussions can reference explicit pros/cons instead of re-debating in pull requests.

### Negative / limitations

- Plaintext JWK IPC and renderer-hosted `CryptoKey`s remain until a lighter or full hardening path is implemented.
- Revisit trigger is manual — no automatic migration when session-locked keychain ships.

## References

- Related ADRs:
  - [0002](./0002-in-memory-non-extractable-private-key-cache.md) — in-memory non-extractable private key cache
  - [0004](./0004-main-process-owns-external-file-reads.md) — main process owns privileged I/O
  - [0016](./0016-electron-safe-storage-private-key-persistence.md) — Electron safeStorage persistence; session-locked keychain (proposed)
- Code (current renderer crypto):
  - `packages/core/src/crypto/privateKeyMaterial.ts` — `UploadedPrivateKeyMaterial`
  - `apps/web/src/crypto/privateKeyFile.ts` — `withUploadedPrivateKey`
  - `apps/web/electron/safeStoragePrivateKey.js` — `safeStorage` encrypt/decrypt
  - `apps/web/electron/main.js` — `private-key:safe-storage:*` IPC handlers
