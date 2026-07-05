# 0014. Request persistent storage and warn on denial

- **Status:** Accepted
- **Date:** 2026-07-05
- **Authors:** Artur Bańka

## Context

The web app keeps encrypted feed data, key manifests, 1:1 threads, and user key material in **IndexedDB** (see [0005](./0005-feed-share-and-comments-parent-dek-model.md)). That data is not mirrored on the server in recoverable form; losing local storage means losing decryptable history unless the user re-imports from backup files.

Browsers treat origin storage as **best-effort**. Under disk pressure or after long inactivity, they may **evict** IndexedDB and `localStorage` for origins that are not marked persistent. The [`navigator.storage.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) API asks the browser to exempt the origin from automatic eviction. Browsers may grant or deny the request based on heuristics (install status, engagement, permission, etc.); denial is common on first visit or in private browsing.

Users should know when their local ciphertext may disappear so they can export backups or adjust browser settings. Silent eviction is a poor UX and undermines trust in local-first crypto workflows.

This is separate from [0002](./0002-in-memory-non-extractable-private-key-cache.md): private keys are intentionally **not** written to IndexedDB. Storage persistence protects **encrypted message and manifest state**, not raw private key bytes.

## Decision

On **explicit sign-in** in a tab session, request persistent storage once and surface the outcome in the UI.

### Request timing

1. Run `requestPersistentStorage()` only when **both** are true:
   - the user is logged in (`AuthProvider` has a `user`), and
   - `isFreshLogin()` is true (`social-fe-fresh-login` in `sessionStorage`).
2. `isFreshLogin()` is set on `login()` and cleared when onboarding completes (`markOnboardingComplete()`) or on logout. That limits the check to the sign-in window rather than every navigation or session restore after onboarding.
3. If `navigator.storage.persist` is missing or throws, treat the outcome as **denied** (`false`).

`requestPersistentStorage()` short-circuits when `storage.persisted()` is already `true`.

### At-risk state

| Outcome                               | `sessionStorage` (`social-fe-storage-at-risk`) | UI                          |
| ------------------------------------- | ---------------------------------------------- | --------------------------- |
| `persist()` granted                   | flag cleared                                   | no warning                  |
| `persist()` denied or API unavailable | `'1'`                                          | warning snackbar + nav icon |

The at-risk flag survives page refresh within the same tab (via `sessionStorage`) so the nav warning remains visible for the session. It is cleared on **logout** with other session auth keys.

### User-facing warnings

- **Snackbar** (top center, 5 s): shown once when persistence is denied on fresh login.
- **Nav warning icon** (`StoragePersistenceWarningNavIcon`): shown while `storagePersistenceAtRisk` is true; tooltip repeats the shared message. Touch devices use `enterTouchDelay={0}` so the tooltip is reachable without hover.

Shared copy lives in `storagePersistenceWarning.ts`:

> This browser may erase your local data when storage is low or after long inactivity.

### Provider wiring

`StoragePersistenceProvider` wraps the authenticated app tree inside `AuthProvider` (sibling to `SessionPrivateKeyProvider`). Internal state remounts per `user?.username` so a login switch resets snackbar and effect lifecycle.

## Consequences

### Positive

- Best-effort protection against silent IndexedDB eviction on supporting browsers.
- Users who are denied persistence get an immediate, persistent (per tab session) warning instead of discovering data loss later.
- Request is scoped to fresh login — avoids noisy re-prompting after onboarding while still covering the moment of engagement browsers weigh for `persist()` grants.
- Failures are non-fatal: denied or missing API degrades to warning only; the app continues to function.

### Negative / limitations

- **`persist()` is a hint, not a guarantee.** Browsers can still evict data; users in strict privacy modes may always be denied.
- **No automatic re-check when not at risk.** If persistence was never requested (e.g. session restored after onboarding completed in a prior visit), the app does not call `persist()` until the next fresh login. When the user **is** at risk, re-checks run on mount and when the tab becomes visible again (e.g. after changing browser site-data settings) — see **Changes** below.
- **Electron** may behave differently from Chromium in the browser; the same API is called but grant rates and eviction policies are platform-dependent.
- Warning does not block usage or force backup — informational only.
- Does not address **private key** loss on refresh ([0002](./0002-in-memory-non-extractable-private-key-cache.md)); recovery still requires the user's JWK file (`/recover-local-data`).

## Alternatives considered

### Do not call `persist()`; only document risk in help/glossary

- Honest but passive; most users never read it.
- **Rejected:** eviction is environment-specific and easy to miss until data is gone.

### Call `persist()` on every app load

- Maximizes chances to obtain persistence after permission changes.
- **Rejected:** repeated calls add little once denied; fresh-login gating matches browser engagement heuristics and avoids work on every route mount.

### Block app usage when persistence is denied

- Strongest signal.
- **Rejected:** many legitimate environments deny `persist()` (Safari, ephemeral profiles, corporate policies); blocking would exclude usable sessions.

### Mirror IndexedDB to the server

- True durability independent of browser eviction policy.
- **Rejected for now:** conflicts with local-first / ciphertext-only server model; export and `LocalDataRecoveryPage` remain the backup path.

## Flow (summary)

```
User signs in (fresh login)
        │
        ▼
requestPersistentStorage()
        │
        ├─ granted ──► clear at-risk flag ──► no UI warning
        │
        └─ denied ──► set at-risk in sessionStorage
                        │
                        ├─► snackbar (once)
                        └─► nav warning icon (until logout or re-check grants)
```

## Changes

### 2026-07-05 — at-risk re-check on visibility

| Topic                   | As accepted                                   | Current                                                                                                                                                                             |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-request after denial | Only on next fresh login in a new tab session | While `storagePersistenceAtRisk` is true, also re-run `requestPersistentStorage()` on provider mount and on `document.visibilitychange` → `visible` (no extra snackbar on recovery) |

## References

- Related ADRs: [0002](./0002-in-memory-non-extractable-private-key-cache.md), [0005](./0005-feed-share-and-comments-parent-dek-model.md)
- MDN: [StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
