# 0015. Browser integration via `encrypt://` custom protocol

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

Users want to encrypt page selections from Chromium without leaving the browser. The **Encrypt desktop (Electron) app** holds keys, IndexedDB recipients, and the encrypt/import UI. A **Chromium MV3 extension** can read the active tab selection on user action (context menu or shortcut) but cannot access the Electron process or its IndexedDB directly.

We need a **local-only bridge** from the extension (or any local caller) to the running desktop app that:

- Reuses existing tray-style encrypt/import flows where possible
- Keeps private keys in the Electron renderer
- Works on Linux, Windows, and macOS packaged builds
- Does not introduce a remote control surface

Early designs considered: a **loopback HTTP API** in Electron main (bearer token), a **`postMessage` bridge** to the Vite web app, and **clipboard handoff** (extension writes selection, deep link carries only the action). Each was rejected for this product (see [Alternatives considered](#alternatives-considered)).

## Decision

### 1. Register `encrypt://` as the OS protocol handler

Electron registers the scheme via `app.setAsDefaultProtocolClient('encrypt')` at runtime and electron-builder `protocols` / Linux `x-scheme-handler/encrypt` in packaged installs.

Incoming URLs are delivered by:

| Platform                      | Delivery                                       |
| ----------------------------- | ---------------------------------------------- |
| Linux / Windows (app running) | `second-instance` argv                         |
| Linux / Windows (cold start)  | `process.argv`                                 |
| macOS                         | `open-url` (may arrive before `ready`; queued) |

Main parses and validates URLs in [`apps/web/electron/deepLinks.js`](../../apps/web/electron/deepLinks.js) before dispatch.

### 2. Deep-link contract (hostname = action)

Encoding: **`text`** as percent-encoded query parameters. Plaintext is **not** placed in the path.

| URL                         | Main behavior                          |
| --------------------------- | -------------------------------------- |
| `encrypt://encrypt?text=…`  | Show in-app recipient picker → encrypt |
| `encrypt://decrypt?text=…`  | Validate JSON → external-text import   |
| `encrypt://copy-public-key` | Write public key to clipboard if ready |

Each action opens or focuses the app when needed; there is no separate `encrypt://show` action.

Private-key material is **never** accepted via deep link.

### 3. Main owns parsing; renderer owns crypto

Same trust split as [0004](./0004-main-process-owns-external-file-reads.md):

- **Main** receives OS protocol events, parses URLs, and forwards **`deep-link:action-request`** IPC (parsed action only). The renderer confirms before any side effect. Tray auth state (`trayIsLoggedIn`) is no longer used to gate deep links in main.
- **Renderer** shows the confirmation dialog, then performs Web Crypto, private-key unlock, IndexedDB writes, and clipboard copy of ciphertext.

Encrypt deep links always open the in-app recipient picker after confirmation. Tray encrypt IPC (recipient chosen in the OS menu) is separate and unchanged.

### 4. Unified desktop encrypt ingress (Command + adapters)

Tray and deep-link paths share one encrypt pipeline:

- **Command:** [`useElectronEncryptPlaintextMessage`](../../apps/web/src/hooks/useElectronEncryptPlaintextMessage.ts) — encrypt plaintext for a recipient, save thread, copy ciphertext, tray flash.
- **Ingress adapters:** [`ElectronDeepLinkHandler`](../../apps/web/src/components/providers/ElectronDeepLinkHandler.tsx) confirms then handles deep-link IPC; [`ElectronDesktopEncryptHandler`](../../apps/web/src/components/providers/ElectronDesktopEncryptHandler.tsx) handles tray encrypt IPC only.

**Tray-only:** [`ElectronTraySync`](../../apps/web/src/components/providers/ElectronTraySync.tsx) syncs auth state and recipient usernames to the OS tray menu. Deep links always use the in-app recipient picker; tray encrypt uses the OS menu recipient.

### 5. Extension launches protocol without a dedicated “open app” action

The extension builds `encrypt://…` URLs and triggers the OS handler by synthesizing an `<a click>` on the active tab when allowed, falling back to a small extension handoff page on restricted URLs (`chrome://`, etc.). There is no standalone “open Encrypt” menu item; encrypt, import, and copy-public-key open the app as needed via their actions.

Chromium may prompt once to allow the external protocol; that is expected browser behavior.

## Consequences

### Positive

- No loopback HTTP server or pairing tokens to operate.
- Encrypt/import/crypto logic is not duplicated between tray and extension ingress.
- Packaged `.desktop` / installer registration makes the handler discoverable by the OS.

### Negative / limitations

- **Plaintext in the URL** appears in process argv, second-instance forwarding, and (on handoff fallback) extension page history. Acceptable for short, local-only MVP messages; not suitable for high-sensitivity content on shared or monitored hosts.
- **No authentication on `encrypt://`:** any local app or HTML link can invoke the handler. Impact is bounded: encrypt still requires login and private-key approval; import is validated and user-confirmed.
- **Confirmation gate (2026-07-24):** every parsed deep link shows an in-app **External request** dialog (preview + Cancel / Continue) before encrypt, import, or copy-public-key runs. Tray IPC is unchanged and does not use this dialog.
- **Handler hijack detection (2026-07-24):** packaged builds verify the default `encrypt://` handler on startup (Linux: `xdg-mime query`); if another app is default, warn and offer **Restore**. Packaged startup does **not** call `setAsDefaultProtocolClient` (that would reclaim the handler before the check). Dev/unpackaged builds skip the check.
- **Browser address bar** does not reliably “discover” custom schemes; users invoke via extension, links, or `xdg-open`, not by typing `encrypt://` in the omnibox.
- **Dev (`electron:dev`)** protocol registration is weaker than a packaged install.

## Alternatives considered

### Loopback HTTP API in Electron main (bearer token)

- Extension `fetch`es `127.0.0.1` with token; main forwards to tray IPC.
- **Rejected:** extra pairing UX, `host_permissions`, and a local control API to harden; deep links reuse OS protocol plumbing already needed for “open with Encrypt.”

### Vite web app `postMessage` bridge (`:5173`)

- Content script talks to page listener; crypto in browser tab IndexedDB.
- **Rejected:** separate session from Electron; wrong runtime for the shipped desktop product.

### Clipboard handoff (extension writes selection; URL carries action only)

- Same ergonomics as tray “encrypt copied message.”
- **Rejected:** duplication of functionalities - no need to have extension. Also there was a discovery that even clipboard may work differently across linux distributions so it's worth to implement new way of communicating with electron app.

### Native Messaging host

- Chromium-standard separate process; still needs a channel to the live Electron session.
- **Rejected for MVP:** equivalent to loopback socket with more OS-specific install steps.

## Guidelines for future changes

1. **Extend the contract in `deepLinks.js` first** — parse/validate/build helpers and tests under `src/tests/electron/`.
2. **Prefer routing new encrypt actions through existing tray IPC** when recipient + plaintext are known in the tray menu (not via deep link).
3. **Do not accept paths, private keys, or unbounded payloads** in deep links.
4. **If confidentiality of selection matters more than simplicity**, add a new ADR for a nonce/clipboard or signed-token channel; do not silently widen the URL contract.

## Changes

### 2026-07-24 — Deep-link confirmation gate

| Topic              | Before                                   | After                                                                                   |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Deep-link dispatch | Main ran copy/encrypt/import immediately | Main sends `deep-link:action-request`; renderer shows **External request** dialog first |
| Copy public key    | Main wrote clipboard directly            | Renderer copies after user confirms                                                     |

### 2026-07-24 — Remove `to=` from encrypt deep links

| Topic                            | Before                                      | After                                       |
| -------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `encrypt://encrypt` query params | `text` and optional `to`                    | `text` only; `to=` rejected                 |
| Extension default recipient      | Options + `encrypt://encrypt?to=…` shortcut | Removed; recipient always chosen in Encrypt |
| Tray encrypt                     | OS menu recipient + IPC                     | Unchanged                                   |

### 2026-07-24 — Remove `encrypt://show`

| Topic             | As accepted      | Current                                                                                                   |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Focus-only action | `encrypt://show` | **Removed** — encrypt, import, and copy-public-key each show/focus the window when their flow requires it |

## References

- Code:
  - [`apps/web/electron/deepLinks.js`](../../apps/web/electron/deepLinks.js) — parse, validate, build
  - [`apps/web/electron/main.js`](../../apps/web/electron/main.js) — protocol registration, dispatch, pending queues
  - [`apps/web/src/hooks/useElectronEncryptPlaintextMessage.ts`](../../apps/web/src/hooks/useElectronEncryptPlaintextMessage.ts) — shared encrypt command
  - [`apps/web/src/components/providers/ElectronDeepLinkHandler.tsx`](../../apps/web/src/components/providers/ElectronDeepLinkHandler.tsx) — deep-link confirm + execution
  - [`apps/web/src/components/providers/ElectronDesktopEncryptHandler.tsx`](../../apps/web/src/components/providers/ElectronDesktopEncryptHandler.tsx) — tray encrypt ingress
  - [`apps/web/src/components/providers/ElectronTraySync.tsx`](../../apps/web/src/components/providers/ElectronTraySync.tsx) — tray-only recipient sync
  - [`apps/extension/`](../../apps/extension/) — MV3 extension, deep-link builder, protocol click handoff
  - [`apps/web/scripts/check-encrypt-protocol.mjs`](../../apps/web/scripts/check-encrypt-protocol.mjs) — packaging / OS handler smoke check
- Related ADRs:
  - [0004](./0004-main-process-owns-external-file-reads.md) — main vs renderer trust for external inputs
  - [0002](./0002-in-memory-non-extractable-private-key-cache.md) — private-key unlock for tray/deep-link encrypt
