# 0002. In-memory non-extractable private key cache

- **Status:** Accepted
- **Date:** 2026-06-17

## Context

Many flows (decrypt inbox, encrypt messages, sign manifests, 1:1 threads) require the user's **private key JWK file**. Prompting for the file on every operation is tedious.

We considered persisting the key locally so it could be reused. That raises serious questions:

- Private key material must not outlive the user's intent.
- Browser storage (IndexedDB, `localStorage`) can survive longer than expected or be readable via DevTools.
- Manual cleanup (`beforeunload`, app-quit hooks) is unreliable: crashes and force-kills can leave data behind.

The Web Crypto API supports **non-extractable** `CryptoKey` objects: JavaScript can use them for allowed operations (`deriveBits`, `sign`) but cannot call `exportKey()` to recover raw JWK bytes.

## Decision

When the user enables **Cache private key** in the settings (default: **off**):

1. On first private-key file pick in a tab, import the JWK into non-extractable `CryptoKey`s and **discard the JWK** from application logic.
2. Cache the imported material **in memory only** (module-level variable), not in IndexedDB or `sessionStorage`.
3. Subsequent operations in the same tab reuse the cached keys without opening the file picker again.
4. Clear the cache on **logout**, when the user **turns the switch off**, or during **Clean local data**.

The cached shape is `UploadedPrivateKeyMaterial`:

| Field                 | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `keyId`               | Public thumbprint (SHA-256 of slim public JWK), computed once at import |
| `ecdhPrivateKey`      | Non-extractable ECDH key for manifest decrypt/derive                    |
| `ecdsaSignPrivateKey` | Non-extractable ECDSA key for signing                                   |

All private-key operations go through `withUploadedPrivateKey()` in `privateKeyFile.ts`, which either returns cached material or prompts for a file, imports, caches (if enabled), and runs the callback.

The user's **preference** (on/off) is stored in `localStorage` only — never the key itself.

## Consequences

### Positive

- Raw JWK bytes are not written to any browser storage API.
- Non-extractable keys cannot be exported via `crypto.subtle.exportKey()`.
- No reliance on lifecycle hooks to delete persisted key material; closing the tab drops memory.
- Simpler implementation than encrypted IndexedDB with a session wrap key.

### Negative / limitations

- **Page refresh** clears the in-memory cache; the user must pick the file again (even with caching enabled).
- **New tab** does not share the cache (each tab has its own JS heap).
- Caching **does not protect against active compromise**: same-origin script (e.g. XSS) can still _use_ the cached `CryptoKey` while the tab is open.
- Electron **hide-to-tray** keeps the renderer alive, so cached keys remain until Quit or logout.

## Alternatives considered

### Plain JWK in `sessionStorage`

- Simple and auto-cleared when the tab closes.
- **Rejected:** full private key visible in DevTools → Application → Session Storage; defeats the purpose of non-extractable import.

### AES-GCM encrypted JWK in IndexedDB + in-memory wrap key

- Ciphertext on disk without the wrap key is useless after the tab closes.
- **Rejected:** manual delete on app close is unreliable; extra complexity for limited benefit over memory-only cache; orphaned ciphertext could still remain after abnormal shutdown.

### Non-extractable `CryptoKey` in IndexedDB

- Structured clone allows storing `CryptoKey` in IndexedDB; keys stay non-extractable.
- **Rejected for now:** still needs explicit cleanup; persists across refresh (different threat model). Could be revisited if refresh survival is required with a clear wipe policy.

### No cache (file picker every time)

- Strongest isolation per operation.
- **Rejected as default UX:** too friction-heavy for frequent decrypt/encrypt flows; kept available by leaving the nav switch default **off**.

## Flow (summary)

```
User enables "Cache private key"
        │
        ▼
withUploadedPrivateKey(fn)
        │
        ├─ cache hit? ──► fn(material)
        │
        └─ cache miss ──► file picker ──► importUploadedPrivateKeyMaterial(jwk)
                              │                    │
                              │                    └─► keyId + ecdh + ecdsa (non-extractable)
                              │
                              └─► cachePrivateKeyMaterial (if enabled) ──► fn(material)
```

## References

- Code:
  - `src/crypto/privateKeyFile.ts` — `withUploadedPrivateKey`
  - `src/crypto/privateKeyMaterial.ts` — import and key-id assertion
  - `src/crypto/sessionPrivateKeyStorage.ts` — in-memory cache
  - `src/utils/sessionPrivateKeyPreference.ts` — user preference (localStorage)
