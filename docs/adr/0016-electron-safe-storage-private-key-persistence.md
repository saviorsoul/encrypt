# 0016. Electron safeStorage private key persistence

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

[ADR 0002](./0002-in-memory-non-extractable-private-key-cache.md) caches imported private keys **in memory only** when the user enables **Cache private key**. That fits the web app: closing the tab drops the cache, and no JWK bytes are written to browser storage.

The Electron desktop build has different UX constraints:

- **Tray encrypt** and **deep links** may run crypto while the window is hidden; users expect not to re-pick the key file every time.
- **Hide-to-tray** keeps the renderer alive, but a full **Quit** or renderer reload still clears the in-memory cache from ADR 0002.
- **Restart** forces another file pick even with caching enabled, which is especially painful for a native app.

Electron provides [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage): encrypt/decrypt strings using the OS credential store (macOS Keychain, Windows DPAPI, Linux secret stores such as GNOME Keyring or KWallet). This is the standard way to persist secrets in Electron without inventing a custom wrap key.

On Linux, the active backend depends on the desktop environment and installed services (`kwallet`, `kwallet5`, `kwallet6`, `gnome-libsecret`, and others Electron may add). Security semantics vary between backends. If no secret store is available, Electron falls back to the `basic_text` backend: `isEncryptionAvailable()` may still be true, but encryption uses a hardcoded password and does **not** provide meaningful protection. We treat `basic_text` the same as unavailable for private-key persistence.

We still want:

- Private keys imported as **non-extractable** `CryptoKey` objects in the renderer for all crypto operations.
- Explicit wipe via **Clean local data** (logout clears in-memory cache only; see Decision §5).
- Main process to own privileged I/O, consistent with [ADR 0004](./0004-main-process-owns-external-file-reads.md).

## Decision

On Electron, **safeStorage is the only private-key source** after an account has been imported on this device. The file picker appears only when logging into an account whose key is not yet stored in safeStorage.

1. **Main process** encrypts the slim private JWK JSON with `safeStorage.encryptString()` and writes the ciphertext to `userData/safe-private-keys/{keyId}.bin`. Filenames use the RFC 7638 thumbprint (`keyId`); path traversal is rejected.
2. **Renderer** imports JWK → non-extractable `CryptoKey`s for crypto. An **optional** in-memory cache of those `CryptoKey`s avoids repeated safeStorage decrypt + import; it is not the source of truth (see [Alternatives considered](#always-load-from-safestorage-no-memory-cache)).
3. **`withUploadedPrivateKey()` on Electron** tries, in order: in-memory cache → safeStorage load by `keyId` → file picker **only if** `has(keyId)` is false. If a file exists but decrypt fails, the app errors instead of re-prompting.
4. **First login for an account on this device**: `ElectronPrivateKeyWarmup` prompts once to import the private key file into safeStorage (after onboarding is complete). New accounts generated in-app are written to safeStorage during onboarding — no import picker.
5. **Clear on clean local data**: `clearSessionPrivateKeyStorage()` deletes safeStorage files. **Logout** clears only the in-memory cache; OS keychain entries survive for the next login.
6. **Secure-backend gate**: `isPrivateKeyEncryptionAvailable()` requires both `safeStorage.isEncryptionAvailable()` and `safeStorage.getSelectedStorageBackend() !== 'basic_text'`.
7. **No cache toggle on Electron**: the web “Cache private key” switch is hidden; desktop always uses the OS keychain model.
8. **Session-locked keychain IPC**: main enforces a phase machine (`boot` → `unlock` → `locked`). After login warmup loads the bound account `keyId` and the renderer caches `CryptoKey`s, `arm-session` locks further `load` / `store` / `has` / file-picker IPC until logout or **Clean local data**. Renderer crypto uses the in-memory cache only. `keyId` is bound via `tray:set-auth-state` and `begin-session`.

The web app and browser builds are **unchanged**: file picker + optional in-memory cache (ADR 0002).

IPC surface (preload → main):

| Channel | Purpose |
| ------- | ------- |
| `private-key:safe-storage:get-status` | Whether persistence is secure (`available`), active backend, and reason when unavailable — always allowed |
| `private-key:safe-storage:begin-session` | Bind the unlock window to the authenticated account `keyId` |
| `private-key:safe-storage:has` | Whether ciphertext exists for the bound `keyId` — `unlock` phase only |
| `private-key:safe-storage:store` | Encrypt and write JWK text for the bound `keyId` — `unlock` phase only |
| `private-key:safe-storage:load` | Decrypt JWK text for the bound `keyId` — `unlock` phase only |
| `private-key:safe-storage:arm-session` | Lock keychain IPC after renderer has cached non-extractable `CryptoKey`s |
| `private-key:safe-storage:get-session-state` | Dev-only: read `{ phase, boundKeyId, isLoggedIn }` for manual verification |
| `private-key:safe-storage:clear-all-for-clean-local-data` | Delete all stored ciphertext files and reset session — **Clean local data** only |
| `private-key:pick-from-dialog` | Native private-key file picker — `unlock` phase only |

### Manual verification (dev Electron)

After login and one successful encrypt/decrypt (warmup + `arm-session`):

1. Open DevTools console (`electron:dev` opens it detached).
2. Inspect session state (dev builds only):

```javascript
await window.electron.privateKeySafeStorage.getSessionState();
// → { phase: 'locked', boundKeyId: '…', isLoggedIn: true }
```

3. Probe blocked IPC (replace `keyId` with `boundKeyId` from step 2):

```javascript
async function probeKeychainLock(keyId) {
  const session = await window.electron.privateKeySafeStorage.getSessionState();
  const status = await window.electron.privateKeySafeStorage.getStatus();
  const probes = {};
  for (const [name, fn] of [
    ['load', () => window.electron.privateKeySafeStorage.load(keyId)],
    ['has', () => window.electron.privateKeySafeStorage.has(keyId)],
    [
      'store',
      () => window.electron.privateKeySafeStorage.store(keyId, '{"kty":"EC"}'),
    ],
    ['pick', () => window.electron.pickPrivateKeyJwkText()],
  ]) {
    try {
      probes[name] = await fn();
    } catch (error) {
      probes[name] = error.message;
    }
  }
  return { session, status, probes };
}

const { boundKeyId } =
  await window.electron.privateKeySafeStorage.getSessionState();
await probeKeychainLock(boundKeyId);
```

Expected when locked: `getStatus` succeeds; `load` / `has` / `store` / `pick` reject with *"keychain is locked for this session"*; in-app encrypt still works (memory cache).

Automated coverage: `src/tests/electron/privateKeySafeStorageSession.test.js` (`keychain lock flow`).

## Consequences

### Positive

- Desktop users stay unlocked across logout/restart; keys are wiped only via **Clean local data**.
- Ciphertext at rest is bound to the OS user account via platform keychain/DPAPI/Linux secret store — not plaintext on disk (when a real backend is selected).
- Renderer still uses non-extractable `CryptoKey`s; safeStorage is a reload path, not the runtime crypto surface.
- Web threat model and code paths stay isolated behind `VITE_ELECTRON`.

### Negative / limitations

- **Stronger persistence than ADR 0002**: encrypted JWK bytes survive logout and app restart until **Clean local data**. Anyone with the OS user session + a running app process could decrypt via `safeStorage`.
- **JWK crosses IPC on each load** from safeStorage (main decrypts → renderer imports → JWK discarded from app variables). Same-machine IPC only. Dropping the in-memory `CryptoKey` cache reduces how long imported keys stay reachable, but does **not** remove this IPC hop while crypto stays in the renderer.
- **Non-extractable `CryptoKey`s are still usable by renderer JS** during an operation (and while cached). `exportKey()` is blocked; sign/decrypt/derive are not. This does not defend against XSS or a compromised renderer bundle.
- **Linux backend variance**: semantics depend on the selected secret store (`gnome-libsecret`, KWallet variants, etc.); we do not normalize behavior beyond Electron's backend selection.
- **Linux `basic_text` fallback**: when no secret store is available, Electron encrypts with a hardcoded password. We detect `getSelectedStorageBackend() === 'basic_text'` and **do not persist** private keys; in-memory cache only.
- **Active renderer compromise** (XSS, malicious dependency) can still _use_ cached `CryptoKey`s during a session. Session-locked keychain IPC blocks post-warmup `load` / `store` / `has` / file picker from the renderer but not signing/decryption with cached keys.
- **Multi-account** stores one file per `keyId`; each account is loaded by explicit `keyId` only.

## Alternatives considered

### Keep ADR 0002 memory-only in Electron

- Simplest security story; no persisted JWK.
- **Rejected:** poor desktop UX for tray encrypt, deep links, and post-restart unlock.

### Non-extractable `CryptoKey` in IndexedDB

- Survives refresh without storing raw JWK.
- **Rejected for now** (same as ADR 0002): IndexedDB is web storage, harder to wipe reliably from main, and does not integrate with OS keychain semantics desktop users expect.

### Custom AES-GCM file + app-derived password

- Portable across platforms without `safeStorage`.
- **Rejected:** reinvents key wrapping; password UX or hardcoded derivation weakens security; `safeStorage` is the Electron-supported approach.

### Plain JWK file in `userData`

- Trivial to implement.
- **Rejected:** private key readable by any process/user with filesystem access to the profile directory.

### Always load from safeStorage, no memory cache

- On every encrypt/decrypt/sign: `safeStorage.load(keyId)` → import non-extractable `CryptoKey`s → run operation → drop references (no `cachePrivateKeyMaterial`).
- **Pros:** smaller window where `CryptoKey`s sit in the renderer heap; safeStorage is clearly the only source; logout needs no memory wipe for keys.
- **Cons:** JWK still crosses IPC and is imported in the renderer on **each** operation; Web Crypto still requires `CryptoKey` in the renderer for `crypto.subtle.sign` / `deriveBits`; XSS can still invoke the same load path; extra latency (keyring decrypt + import per op).
- **Rejected for now** as the default: modest security gain vs measurable cost on tray/deep-link and batch decrypt paths. Reasonable follow-up if profiling shows cache is unnecessary or if combined with narrower IPC (below).

### Main-process crypto (key never imported in renderer)

- Main decrypts from safeStorage and performs ECDH/ECDSA in Node; renderer uses operation-level IPC only.
- **Postponed** — large refactor; see [ADR 0017](./0017-electron-main-process-private-key-crypto.md) for pros, cons, and security trade-offs. Session-locked keychain IPC (below) is the preferred lighter hardening.

### Session-locked keychain IPC

Implemented in Decision §8. Main auto-locks after the renderer arms the session (`private-key:safe-storage:arm-session`), which runs once the in-memory `CryptoKey` cache is warm — not immediately when `load` returns JWK over IPC. See `apps/web/electron/privateKeySafeStorageSession.js`.

## Hardening backlog (Electron private key)

| Hardening | Blocks | Notes |
| --------- | ------ | ----- |
| **Rate-limit `load` in `unlock`** | Brute-force / probing | Low value (thumbprint space) but cheap |
| **Idle lock (drop cache + phase → `boot`)** | Long-lived tray sessions | Optional UX trade-off; requires re-login warmup |
| **User-gesture gate for first keychain decrypt** | Drive-by warmup | “Unlock keychain” button vs silent warmup on login |
| **Main-process crypto** | JWK / `CryptoKey` in renderer at all | Large refactor; postponed — [ADR 0017](./0017-electron-main-process-private-key-crypto.md) |

## Flow (Electron)

```
withUploadedPrivateKey(fn)
        │
        ├─ in-memory cache hit? ──► fn(material)
        │
        ├─ unlock phase: safeStorage.load(keyId)? ──► import ──► cache ──► lock ──► fn(material)
        │
        ├─ locked phase: cache miss ──► error (log out and sign in again)
        │
        └─ first use of account on device ──► file picker ──► safeStorage.store ──► fn(material)
```

## References

- Code:
  - `apps/web/electron/safeStoragePrivateKey.js` — encrypt, decrypt, file I/O
  - `apps/web/electron/privateKeySafeStorageSession.js` — session phase machine
  - `apps/web/electron/main.js` — IPC handlers
  - `apps/web/electron/preload.cjs` — `privateKeySafeStorage` bridge
  - `apps/web/src/crypto/electronSafeStoragePrivateKey.ts` — renderer wrapper
  - `apps/web/src/crypto/privateKeyFile.ts` — `withUploadedPrivateKey` integration
  - `apps/web/src/crypto/sessionPrivateKeyStorage.ts` — in-memory cache + clear
  - `apps/web/src/components/providers/ElectronPrivateKeyWarmup.tsx` — login warmup
- Related ADRs: [0002](./0002-in-memory-non-extractable-private-key-cache.md), [0004](./0004-main-process-owns-external-file-reads.md), [0017](./0017-electron-main-process-private-key-crypto.md) (postponed main-process crypto)
