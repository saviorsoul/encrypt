# Encrypt

End-to-end encrypted messaging app. The user-facing client is built with React and Electron; shared crypto and feed logic live in `@encrypt/core`.

## Usage

There is a GitHub Pages site — [saviorsoul.github.io/encrypt/](https://saviorsoul.github.io/encrypt/) — that you can visit to learn more about this app. However, the best user experience is always provided by the desktop application.

The **Encrypt** app (web and Electron) does not connect to any backend service. All messages are stored locally in the built-in browser database, IndexedDB.

This repository also includes a **feed API** and **feed-lab** dev UI for testing server-backed encrypted feeds during development. Those are optional and not used by the published desktop or GitHub Pages app.

## Discord

There is a [Discord](https://discord.gg/PAmgfU7ZR9) server you can join for announcements, release plans, or just to get in touch.

## Download

Pre-built desktop installers are published on [GitHub Releases](https://github.com/saviorsoul/encrypt/releases/latest):

- **Windows** — download the `.exe` installer
- **Linux** — download the `.deb` package (Ubuntu / Debian)

## Repository structure

npm workspaces monorepo:

| Package | Path | Description |
| ------- | ---- | ----------- |
| `@encrypt/web` | `apps/web` | Main React + Electron app (local-first) |
| `@encrypt/api` | `apps/api` | Koa HTTP API, Prisma, PostgreSQL/Citus |
| `@encrypt/feed-lab` | `apps/feed-lab` | Dev UI for testing the backend |
| `@encrypt/core` | `packages/core` | Shared crypto, feed types, API client |
| `@encrypt/schemas` | `packages/schemas` | Shared schemas |

## Prerequisites for local development

You need **Node.js 24 or newer** and **npm** (included with Node.js).

For the full backend stack you also need **Docker** with Compose v2 (`docker compose`).

Check that they are installed:

```bash
node --version
npm --version
docker compose version   # optional, for API + feed-lab stack
```

## Install Node.js

### Windows

1. Download the **LTS** installer from [https://nodejs.org](https://nodejs.org).
2. Run the installer and accept the defaults (npm is included).
3. Open **Command Prompt** or **PowerShell** and run `node --version` to confirm.

### Linux

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

## Getting started

1. Clone the repository and go into the project folder:

   ```bash
   git clone git@github.com:saviorsoul/encrypt.git
   cd encrypt
   ```

2. Install dependencies (from the repo root):

   ```bash
   npm install
   ```

3. Start the main app:

   ```bash
   npm start
   ```

   The app opens at [http://localhost:5173](http://localhost:5173). The page reloads when you edit files.

### Environment variables

For local API or feed-lab development, copy the env template:

```bash
cp .env.example .env
```

Vite apps read from the repo root (`envDir`). The API loads `.env` on startup. See `.env.example` for `DATABASE_URL`, `VITE_API_URL`, and related settings.

Docker uses committed defaults in `.env.docker`. See [docker/README.md](docker/README.md) for the full stack.

### Backend + feed-lab (optional)

To run the API and feed-lab against a Citus database in Docker:

```bash
npm run dev:stack:build   # first time: build images, migrate, distribute tables
```

Then open:

- **feed-lab** — [http://localhost:5174](http://localhost:5174)
- **API health** — [http://localhost:3000/health](http://localhost:3000/health)

To run API and feed-lab on the host (with Citus still in Docker):

```bash
npm run dev:api    # API on port 3000
npm run dev:lab    # feed-lab on port 5174
```

Database setup on the host (with `DATABASE_URL` in `.env`):

```bash
npm run db:setup
```

More detail: [docker/README.md](docker/README.md).

## Desktop app (Electron)

The same UI runs as a desktop app via Electron. The desktop app has additional functionality:

- disabled network requests
- opening files directly in your system (Open with → Encrypt)
- system tray functions:
  - encrypt plain text from the **clipboard** to a specific recipient and write encrypted text back to the **clipboard**
  - import an encrypted message
  - copy the public key of the current user

### Development

Starts Vite and opens the app in an Electron window with hot reload:

```bash
npm run electron:dev
```

### Preview production build

Builds the app for Electron and runs it locally without packaging:

```bash
npm run electron:preview
```

### Package installers

Builds platform-specific installers with [electron-builder](https://www.electron.build/):

```bash
npm run electron:build
```

Output is written to `release/`. Linux builds produce a **deb** package; Windows builds produce an **NSIS** installer; macOS builds produce a **dmg**.

On Linux, the dev and preview scripts pass `--no-sandbox` to Electron to avoid sandbox issues in some environments.

### Open files from the file manager (Ubuntu)

The desktop app accepts `.json` and `.jwk` files opened from the file manager or passed on the command line. When a file is sent to the app, a dialog asks whether to **import an encrypted message**, **add a recipient with the provided public key**, or **sign in with a private key**.

After installing the `.deb` package (from [GitHub Releases](https://github.com/saviorsoul/encrypt/releases/latest) or a local `release/` build), right-click a `.json` or `.jwk` file and choose **Open With → Encrypt**. If Encrypt is not listed, use **Open With Other Application** once; later opens will show it in the menu.

The installed binary is at `/opt/Encrypt/encrypt`. File associations are registered automatically by the `.deb` installer.

#### Manual verification (development)

Build and run the desktop app, passing a file path after `--`:

```bash
# Cold start with a file (builds dist/, then opens the app)
npm run electron:preview -- /path/to/file.json

# App already built or already running — open a file without rebuilding
npm run electron:run -- /path/to/file.json
```

Use an absolute path to a real `.json` or `.jwk` file. The path must come **after** `--` so npm forwards it to Electron.

Canceling the chooser dialog clears the queued file with no other side effects.

## Commands

Root scripts delegate to workspaces. Run them from the repository root.

### Main app (`@encrypt/web`)

| Command | Description |
| ------- | ----------- |
| `npm start` | Dev server at [http://localhost:5173](http://localhost:5173) |
| `npm test` | Run web + API tests |
| `npm run build` | Production web build to `apps/web/dist/` |
| `npm run build:pages` | Build for GitHub Pages |
| `npm run preview` | Preview the production web build |
| `npm run electron:dev` | Electron dev server with hot reload |
| `npm run electron:preview` | Build and run the Electron app locally |
| `npm run electron:run` | Run Electron from existing `dist/` build |
| `npm run electron:build` | Package desktop installers to `release/` |

### API + feed-lab

| Command | Description |
| ------- | ----------- |
| `npm run dev:api` | API dev server (port 3000) |
| `npm run dev:lab` | feed-lab dev server (port 5174) |
| `npm run dev:stack` | Start Docker stack (Citus + API + feed-lab) |
| `npm run dev:stack:build` | Build images and start stack |
| `npm run dev:stack:logs` | Follow Docker logs |
| `npm run docker:down` | Stop Docker stack |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:citus:distribute` | Run Citus distribution SQL |
| `npm run db:seed` | Seed database |
| `npm run db:setup` | Migrate + distribute (host or CI) |

### Tooling

| Command | Description |
| ------- | ----------- |
| `npm run lint` | Check lint and formatting (ESLint + Prettier) |
| `npm run lint:fix` | Auto-fix lint and formatting issues |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Check formatting without writing changes |

## Linting and formatting

The project uses **ESLint** for code quality and **Prettier** for formatting. Prettier runs as an ESLint rule (`eslint-plugin-prettier`), so formatting problems appear as ESLint errors and are fixed together with `npm run lint:fix`.

Config files:

- `eslint.config.js` — ESLint rules (TypeScript, React Hooks, React Refresh)
- `.prettierrc` — Prettier style options

### Editor setup (VS Code / Cursor)

Install the recommended extensions when prompted, or from `.vscode/extensions.json`:

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)

Workspace settings in `.vscode/settings.json` enable format on save (Prettier) and ESLint auto-fix on save.

## License

[MIT](LICENSE)
