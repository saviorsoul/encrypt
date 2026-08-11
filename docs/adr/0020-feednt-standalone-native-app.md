# 0020. Feednt standalone native app

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

[feed-lab](../../apps/feed-lab/) serves browser users and integrates with the Encrypt system app via the bridge ([ADR 0018](./0018-feed-lab-bridge-via-encrypt-protocol.md), [ADR 0019](./0019-feed-lab-bridge-selective-confirmation.md)). Mobile bridge UX remains limited (OS context switches, iOS custom-scheme constraints).

We need a **native Feednt product** that:

- Holds private keys in OS secure storage (same model as Encrypt — [ADR 0016](./0016-electron-safe-storage-private-key-persistence.md))
- Talks to the feed API directly (no `encrypt://` bridge)
- Uses looser CSP / network policy than the offline-first Encrypt app

## Decision

### 1. Separate app: `apps/feednt`

| Surface | Path | Role |
| ------- | ---- | ---- |
| Shared React UI | `apps/feednt/src` | Product logic, providers, pages |
| Electron desktop | `apps/feednt/local` | Thin shell (`com.feednt.app`) |
| Capacitor mobile | `apps/feednt/mobile` | Thin shell (`com.feednt.app`) |

Runtime composition: each shell injects a `PlatformAdapter` via build alias `@feednt/runtime` → `createPlatformAdapter()` from `@encrypt/platform`.

### 2. Shared packages (composition, not inheritance)

| Package | Purpose |
| ------- | ------- |
| `@encrypt/core` | Crypto, feed API client (unchanged) |
| `@encrypt/ui` | Generic MUI primitives |
| `@encrypt/platform` | Private-key custody (Electron safeStorage, Capacitor SecureStorage) |
| `@encrypt/csp` | Network-aware CSP for Feednt; strict CSP for Encrypt |

Feednt **does not** depend on `apps/web`, `apps/feed-lab`, or bridge packages.

### 3. feed-lab unchanged in role

- Browser + optional Encrypt bridge remains in `apps/feed-lab`
- Bridge host remains in `apps/web` (Encrypt app)
- ADR 0018 “external browser” applies to feed-lab, not Feednt native

### 4. Key storage namespace

- Electron: separate `userData` via `com.feednt.app`
- Capacitor: `feednt-pk-{keyId}` prefix (Encrypt uses `encrypt-pk-`)

### 5. v1 scope

- Platform-key login
- Read-only authenticated feed inbox
- No send/share/friendship UI in v1

## Consequences

### Positive

- Best native UX without removing browser feed-lab or bridge work
- Shared platform key code reduces duplication with Encrypt
- Clear dependency boundaries between products

### Negative

- Two feed clients to maintain (feed-lab browser + Feednt native) until optional `@encrypt/feed-ui` extraction
- Capacitor `android/` / `ios/` projects require initial `cap add` on developer machines

## References

- Code:
  - [`apps/feednt/`](../../apps/feednt/)
  - [`packages/platform/`](../../packages/platform/)
  - [`packages/ui/`](../../packages/ui/)
  - [`packages/csp/`](../../packages/csp/)
- Related ADRs:
  - [0018](./0018-feed-lab-bridge-via-encrypt-protocol.md)
  - [0016](./0016-electron-safe-storage-private-key-persistence.md)
