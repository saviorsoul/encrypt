# 0004. Main process owns external file reads (no path-based IPC from renderer)

- **Status:** Accepted
- **Date:** 2026-06-20

## Context

The Electron build opens `.json` and `.jwk` files via OS integration (`open-file`, argv, second instance). The renderer needs file **contents** to classify and import messages or keys.

The original design exposed `readExternalFile(filePath)` on `window.electron`. The renderer called it after receiving `external-file:opened` with metadata only. Main validated the path (extension, exists, size) and read the file.

That pattern is a common Electron mistake: **the less-trusted renderer chooses the path; the more-trusted main process performs the privileged operation.** Main checked _how_ to read (`.json`/`.jwk`, max size) but not _whether the user opened that file_.

### Why that is a security problem

Electron splits the app into two trust levels:

| Process | Trust | Typical powers |
| ------- | ----- | -------------- |
| **Renderer** | Lower (UI, Web Crypto, React) | Same-origin script, user-visible logic |
| **Main** | Higher (Node.js) | Filesystem, clipboard, native dialogs, tray |

IPC bridges these levels. Any API of the form “renderer sends a path → main reads it” grants **filesystem read** to whatever can run in the renderer.

 Preconditions for abuse: attacker code in the renderer (XSS, compromised dependency, DevTools in dev, future bug). This is **not** remote internet access — production blocks outbound network — but it **is** local privilege expansion: UI compromise → read many local `.json`/`.jwk` files the app process can access (private keys, API tokens, app configs).

Extension and size limits reduce impact but do not fix the trust violation: many secrets live in `.json` or `.jwk` files under 5 MB.

### Intended vs actual authority

**Intended:** Only files the user opened through the OS (or a main-owned dialog) are read.

**Actual (before fix):** Any path passing validation could be read if the renderer requested it.

## Decision

1. **Remove** `external-file:read` from preload and main IPC handlers.
2. **Main reads** external files when dispatching `external-file:opened`, only if the resolved path is in `externalFileQueue` (`assertExternalFileInQueue`).
3. **Send content with the event:** `ExternalFileOpenedPayload` is metadata plus either `{ text }` or `{ error }`. The renderer never sends a path back to read.
4. **Normalize paths** with `resolveExternalFilePath` when enqueueing, reading, and consuming so queue membership is stable.
5. **`external-file:consume`** also requires the path to be in the pending queue before dequeue.

Private key picking already followed the safe pattern: `private-key:pick-from-dialog` opens the native dialog in main and returns **text only** — no path argument from the renderer.

## Consequences

### Positive

- Renderer cannot enumerate or read arbitrary local `.json`/`.jwk` files via IPC.
- User intent (OS open / file association) is enforced in main, not replayed from renderer input.
- Aligns external-file flow with the private-key dialog pattern.

### Negative / limitations

- File content crosses the IPC boundary in one message (larger payload than metadata-only). Acceptable given the 5 MB cap already enforced for imports.
- `external-file:consume` still accepts a path string from the renderer, but only to dequeue a path main already announced; it cannot trigger a new read.
- Does not protect against a compromised renderer using **other** IPC (clipboard write, tray state) or cached private keys (see ADR 0002).

## Guidelines for future Electron IPC

When adding or reviewing `window.electron` APIs:

1. **Main owns privileged inputs.** Files come from OS events, native dialogs, or clipboard in main — not from renderer-supplied paths.
2. **Prefer returning data over capabilities.** Return file text, not `read(path)`. Return dialog result, not “read whatever path I name.”
3. **Allowlist pending operations.** If a path must be referenced twice (open → consume), track it in main and reject unknown paths.
4. **Validate sender if the surface grows.** Today a single window is assumed; add `event.senderFrame` / `webContents.id` checks if secondary windows or `<webview>` are introduced.
5. **Treat preload as a public API.** Every exposed function is callable by any script in the renderer.
6. **Do not confuse UI validation with authority.** Extension/size checks are necessary but not sufficient; the question is “who decided this resource?”

### Red flags in IPC design

- Handler takes a **filesystem path** from the renderer
- Handler performs **read/write/exec** based on renderer input without an main-side allowlist
- “Convenience” split where main notifies and renderer requests the sensitive half

### Safer patterns

| Need | Pattern |
| ---- | ------- |
| User opens file | Main enqueues on OS event → main reads → push `{ metadata, text \| error }` |
| User picks file | `dialog.showOpenDialog` in main → main reads → return text or error |
| User imports from clipboard | Main reads clipboard in main (tray/menu) → push validated payload |

## Alternatives considered

### Keep `readExternalFile` but allowlist queue membership

- Renderer still passes a path; main checks `externalFileQueue` before read.
- **Rejected as primary fix:** removes arbitrary read but keeps redundant IPC and keeps the dangerous API shape one mistake away from regression. Reading in main on open is simpler and eliminates the channel.

### Send file path only; renderer uses web `<input type="file">`

- Works for web build; Electron OS association still needs main.
- **Rejected for Electron path:** does not cover argv/`open-file`; duplicates logic.

## References

- Code:
  - `electron/main.js` — `externalFileQueue`, `sendExternalFileOpened`, `readExternalFileText`, `assertExternalFileInQueue`
  - `electron/preload.cjs` — no path-based read API
  - `src/vite-env.d.ts` — `ExternalFileOpenedPayload`
  - `src/components/providers/ExternalFileProvider.tsx` — consumes opened payload
- Related ADRs:
  - [0001](./0001-use-architecture-decision-records.md) — when to write ADRs
  - [0002](./0002-in-memory-non-extractable-private-key-cache.md) — separate renderer compromise surface (cached keys)
