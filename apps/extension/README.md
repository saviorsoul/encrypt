# Encrypt browser extension

Chromium MV3 extension that drives the **Encrypt desktop (Electron) app** through `encrypt://` deep links.

## Requirements

1. Install and run the Encrypt desktop app (protocol `encrypt://` registered).
2. Load this extension unpacked from `apps/extension/dist` after building.

## Build

```bash
npm install
npm run build -w @encrypt/extension
```

Then in Chrome/Chromium: **Extensions → Developer mode → Load unpacked** → select `apps/extension/dist`.

## Actions

| Context menu / command     | Deep link                                            |
| -------------------------- | ---------------------------------------------------- |
| Encrypt selection          | `encrypt://encrypt?text=…` (recipient picker in app) |
| Decrypt selection          | `encrypt://decrypt?text=…`                           |
| Public key into clipboard  | `encrypt://copy-public-key`                          |

Configure which actions are enabled on the extension options page (toolbar icon). Remap keyboard shortcuts at `chrome://extensions/shortcuts`.

Encrypt opens automatically when an action needs it. The recipient for encrypt is always chosen inside Encrypt.

## Notes

- On normal web pages, the extension launches `encrypt://…` by synthesizing a link click **in the current tab** (no extra tab). Chromium may still ask once to **Open Encrypt** — allow it and optionally remember the choice.
- On restricted pages (`chrome://`, the Chrome Web Store, etc.) it falls back to a small extension handoff page.
- Selection text is read from the page with block line breaks preserved (like copy-as-plain-text), then encoded in the deep-link URL and passed to the OS / Encrypt process argv for that launch. Very long selections may hit OS or browser URL length limits; import `text` is capped at **32 KiB** in the protocol parser.
- The extension never holds private keys; crypto runs in Encrypt.
- Packaging: Electron registers `encrypt` via `setAsDefaultProtocolClient` and electron-builder `protocols` / Linux `x-scheme-handler/encrypt`.
- If Encrypt is already running, the OS starts a second process that forwards the URL to the first instance (`second-instance`). Rebuild/reinstall the desktop app if an older build is still installed.
