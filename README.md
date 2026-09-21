# Encrypt

Open-source tools for **end-to-end encrypted** messaging.

This repository holds several related apps that share the same encryption mechanism but serves different purposes.

## The apps

### Encrypt — private messaging on your device

**Encrypt** lets you write and read encrypted messages locally. Nothing is uploaded to servers - your inbox and recipients lives on your own computer or phone.

- Works fully offline
- Import and export encrypted messages as text of files
- Desktop extras: no network access, system tray shortcuts, clipboard encrypt/decrypt, and **Open with → Encrypt** for `.json` / `.jwk` files

Try the web version at [saviorsoul.github.io/encrypt/](https://saviorsoul.github.io/encrypt/). For day-to-day use, install the desktop app (see [Download](#download) below).

### Feedn't — encrypted feed

**Feedn't** is an alternative to mainstream social networks: a feed you can share with friends, with end-to-end encryption so the server never sees your posts in plain text.

- Messages sync through a backend, but are encrypted before they leave your device
- Native apps for web, desktop, and mobile
- Designed to know as little about you as possible

Encrypt and Feedn't are separate apps but use the same cryptographic protocol.

### Browser extension — encrypt text from any webpage

A small **Chromium extension** connects your browser to the Encrypt desktop app. Highlight text on a page, choose _Encrypt_ or _Decrypt_, and the desktop app handles the cryptography.

The extension never holds your private key; all crypto runs inside Encrypt.

## Download

Pre-built desktop installers are published on [GitHub Releases](https://github.com/saviorsoul/encrypt/releases/latest):

- **Windows** — download the `.exe` installer
- **Linux** — download the `.deb` package (Ubuntu / Debian)
- **Android** — download the `.apk` package

## Discord

Join the [Discord](https://discord.gg/PAmgfU7ZR9) server for announcements, release plans, or to get in touch.

---

## For developers

The project is an **npm workspaces monorepo**. Apps live under `apps/`; shared cryptography, feed logic, and UI live in `packages/` (mainly `@encrypt/core`).

Beyond the user-facing apps above, the repo also ships **feed-lab** (dev UI for Feed API flows) and the **Feed API** itself (Koa, PostgreSQL/Citus).

### Repository structure

Workspaces are declared in the root `package.json`. High-level layout:

```
apps/
  encrypt/          # Local-first messaging (web, desktop, mobile)
  feednt/           # Feedn't — server-backed feed client (web, desktop, mobile)
  feed-lab/         # Feed API dev UI (web)
  api/              # Feed API (Koa + Prisma)
  extension/        # Chromium extension for Encrypt desktop
  landing-page/     # Marketing / docs site
packages/
  core/             # Crypto, feed logic, API client
  schemas/          # Shared JSON schemas
  ui/               # Shared MUI components
  platform/         # OS secure storage adapters
  csp/              # Content-Security-Policy helpers
```

| Package              | Path                   | Description                                      |
| -------------------- | ---------------------- | ------------------------------------------------ |
| `@encrypt/web`       | `apps/encrypt/web`     | Encrypt React web app (local-first)              |
| `@encrypt/desktop`   | `apps/encrypt/desktop` | Encrypt Electron desktop shell                   |
| `@encrypt/mobile`    | `apps/encrypt/mobile`  | Encrypt Capacitor mobile shell                   |
| `@feednt/web`        | `apps/feednt/web`      | Feedn't shared React UI                          |
| `@feednt/desktop`    | `apps/feednt/desktop`  | Feedn't Electron shell                           |
| `@feednt/mobile`     | `apps/feednt/mobile`   | Feedn't Capacitor shell                          |
| `@feed-lab/web`      | `apps/feed-lab/web`    | feed-lab dev UI for the Feed API                 |
| `@encrypt/api`       | `apps/api`             | Feed API — Koa, Prisma, PostgreSQL/Citus         |
| `@encrypt/extension` | `apps/extension`       | Chromium MV3 extension (`encrypt://` deep links) |
| `@encrypt/core`      | `packages/core`        | Shared crypto, feed types, API client            |
| `@encrypt/schemas`   | `packages/schemas`     | Shared schemas                                   |
| `@encrypt/ui`        | `packages/ui`          | Shared UI components                             |
| `@encrypt/platform`  | `packages/platform`    | Secure storage / platform adapters               |
| `@encrypt/csp`       | `packages/csp`         | CSP configuration helpers                        |

### Prerequisites

You need **Node.js 24 or newer** and **npm** (included with Node.js).

For the full backend stack you also need **Docker** with Compose v2 (`docker compose`).

Check that they are installed:

```bash
node --version
npm --version
docker compose version   # optional, for API + feed-lab stack
```

### Install Node.js

#### Windows

1. Download the **LTS** installer from [https://nodejs.org](https://nodejs.org).
2. Run the installer and accept the defaults (npm is included).
3. Open **Command Prompt** or **PowerShell** and run `node --version` to confirm.

#### Linux

**Ubuntu / Debian**

```bash
sudo apt update
sudo apt install -y nodejs npm
```

If the installed version is below 24, install Node.js 24 globally with [NodeSource](https://github.com/nodesource/distributions):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

Alternatively, download the Linux installer from [https://nodejs.org](https://nodejs.org). If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project directory (see `.nvmrc`).

### Getting started

1. Clone the repository and go into the project folder:

   ```bash
   git clone git@github.com:saviorsoul/encrypt.git
   cd encrypt
   ```

2. Install dependencies (from the repo root):

   ```bash
   npm install
   ```

3. Start the app you are working on:

   ```bash
   npm run encrypt:dev      # Encrypt web — http://localhost:5173
   npm run feednt:dev       # Feedn't web — http://localhost:5180
   npm run feed-lab:dev     # feed-lab — http://localhost:5174 (Feed API optional)
   npm run dev:api          # Feed API — http://localhost:3000
   ```

   For Encrypt, the page reloads when you edit files. Feedn't and feed-lab need `VITE_API_URL` in `.env` when talking to a local API (see below).

#### Environment variables

For local API or feed-lab development, copy the env template:

```bash
cp .env.example .env
```

Vite apps read from the repo root (`envDir`). The API loads `.env` on startup. See `.env.example` for `DATABASE_URL`, `VITE_API_URL`, and related settings.

Docker uses committed defaults in `.env.docker`. See [docker/README.md](docker/README.md) for the full stack.

#### Backend + feed-lab (optional)

To run the API and feed-lab against a Citus database in Docker:

```bash
npm run dev:stack:build   # first time: build images, migrate, distribute tables
```

Then open:

- **feed-lab** — [http://localhost:5174](http://localhost:5174)
- **API health** — [http://localhost:3000/api/health](http://localhost:3000/api/health)

To run API and feed-lab on the host (with Citus still in Docker):

```bash
npm run dev:api    # API on port 3000
npm run feed-lab:dev    # feed-lab on port 5174
```

Database setup on the host (with `DATABASE_URL` in `.env`):

```bash
npm run db:setup
```

More detail: [docker/README.md](docker/README.md).

### Encrypt desktop app (Electron)

The desktop shell adds network isolation, file associations, system-tray actions (clipboard encrypt/decrypt, import message, copy public key), and `encrypt://` deep-link handling for the browser extension.

#### Development

Starts Vite and opens the app in an Electron window with hot reload:

```bash
npm run encrypt:desktop:dev
```

#### Preview production build

Builds the app for Electron and runs it locally without packaging:

```bash
npm run encrypt:desktop:preview
```

#### Package installers

Builds platform-specific installers with [electron-builder](https://www.electron.build/):

```bash
npm run electron:build
```

Output is written to `release/`. Linux builds produce a **deb** package; Windows builds produce an **NSIS** installer; macOS builds produce a **dmg**.

On Linux, the dev and preview scripts pass `--no-sandbox` to Electron to avoid sandbox issues in some environments.

Packaged builds register the `encrypt://` URL scheme (deep links from the browser extension). See [apps/extension/README.md](apps/extension/README.md).

Check protocol wiring (unit tests + OS probe):

```bash
npm run encrypt:test:protocol
```

After installing the desktop app, require the OS handler:

```bash
REQUIRE_OS_HANDLER=1 npm run encrypt:test:protocol
```

Manual browser check: open [`apps/encrypt/desktop/electron/protocol-test.html`](apps/encrypt/desktop/electron/protocol-test.html) and click a link (do not rely on typing `encrypt://` in the address bar).

#### Browser extension (Chromium)

Build and load the unpacked MV3 extension that sends selections to the Encrypt desktop app via `encrypt://` deep links:

```bash
npm run build:extension
```

Load `apps/extension/dist` in Chrome/Chromium (**Extensions → Load unpacked**). The Encrypt desktop app must be installed so the OS handles `encrypt://`. Details: [apps/extension/README.md](apps/extension/README.md).

#### Open files from the file manager (Ubuntu)

When a `.json` or `.jwk` file is opened, the app asks whether to **import an encrypted message**, **add a recipient**, or **sign in with a private key**. After installing the `.deb`, use **Open With → Encrypt** (or **Open With Other Application** once). Installed binary: `/opt/Encrypt/encrypt`.

##### Manual verification

Build and run the desktop app, passing a file path after `--`:

```bash
# Cold start with a file (builds dist/, then opens the app)
npm run encrypt:desktop:preview -- /path/to/file.json

# App already built or already running — open a file without rebuilding
npm run encrypt:desktop:run -- /path/to/file.json
```

Use an absolute path to a real `.json` or `.jwk` file. The path must come **after** `--` so npm forwards it to Electron.

Canceling the chooser dialog clears the queued file with no other side effects.

### Commands

Root scripts delegate to workspaces. Run them from the repository root.

#### Encrypt (`@encrypt/web`, `@encrypt/desktop`, `@encrypt/mobile`)

| Command                           | Description                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run encrypt:dev`             | Dev server at [http://localhost:5173](http://localhost:5173) |
| `npm run encrypt:test`            | Run web + API tests                                          |
| `npm run encrypt:build`           | Production web build to `apps/encrypt/web/dist/`             |
| `npm run encrypt:build:pages`     | Build for GitHub Pages                                       |
| `npm run encrypt:preview`         | Preview the production web build                             |
| `npm run encrypt:desktop:dev`     | Electron dev server with hot reload                          |
| `npm run encrypt:desktop:preview` | Build and run the Electron app locally                       |
| `npm run encrypt:desktop:run`     | Run Electron from existing `dist/` build                     |
| `npm run encrypt:desktop:build`   | Package desktop installers to `release/`                     |
| `npm run encrypt:mobile:dev`      | Capacitor dev server (port 5175)                             |
| `npm run build:extension`         | Build Chromium extension to `apps/extension/dist/`           |
| `npm run dev:extension`           | Same as `build:extension`                                    |

#### Feedn't (`@feednt/web`, `@feednt/desktop`, `@feednt/mobile`)

| Command                      | Description                          |
| ---------------------------- | ------------------------------------ |
| `npm run feednt:dev`         | Feedn't web dev server (port 5180)   |
| `npm run feednt:desktop:dev` | Feedn't Electron dev with hot reload |
| `npm run feednt:mobile:dev`  | Feedn't Capacitor dev server         |

#### API + feed-lab

| Command                       | Description                                 |
| ----------------------------- | ------------------------------------------- |
| `npm run dev:api`             | API dev server (port 3000)                  |
| `npm run feed-lab:dev`        | feed-lab dev server (port 5174)             |
| `npm run dev:stack`           | Start Docker stack (Citus + API + feed-lab) |
| `npm run dev:stack:build`     | Build images and start stack                |
| `npm run dev:stack:logs`      | Follow Docker logs                          |
| `npm run docker:down`         | Stop Docker stack                           |
| `npm run db:migrate`          | Apply Prisma migrations                     |
| `npm run db:citus:distribute` | Run Citus distribution SQL                  |
| `npm run db:seed`             | Seed database                               |
| `npm run db:setup`            | Migrate + distribute (host or CI)           |

#### Tooling

| Command                | Description                                   |
| ---------------------- | --------------------------------------------- |
| `npm run lint`         | Check lint and formatting (ESLint + Prettier) |
| `npm run lint:fix`     | Auto-fix lint and formatting issues           |
| `npm run format`       | Format all files with Prettier                |
| `npm run format:check` | Check formatting without writing changes      |

### Linting and formatting

The project uses **ESLint** for code quality and **Prettier** for formatting. Prettier runs as an ESLint rule (`eslint-plugin-prettier`), so formatting problems appear as ESLint errors and are fixed together with `npm run lint:fix`.

Config files:

- `eslint.config.js` — ESLint rules (TypeScript, React Hooks, React Refresh)
- `.prettierrc` — Prettier style options

#### Editor setup (VS Code / Cursor)

Install the recommended extensions when prompted, or from `.vscode/extensions.json`:

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)

Workspace settings in `.vscode/settings.json` enable format on save (Prettier) and ESLint auto-fix on save.

### Development with AI

This project is built with a mix of deliberate engineering and AI-assisted development. Cryptography, data handling, and security rules are designed and reviewed by a human: documented in open RFCs and ADRs, backed by automated tests, and checked against a clear threat model.

Day-to-day implementation—features, refactors, tests, and UI—is often done with **Composer** (Cursor’s AI coding assistant). That speeds iteration (“vibe coding”: describe intent, refine in conversation) but does not replace judgment. AI suggestions are reviewed, constrained by existing architecture, and rejected when they conflict with encryption or privacy goals.

## License

[MIT](LICENSE)
