# Encrypt

Encryption app run locally. Build with React and Electron.

## Prerequisites

You need **Node.js 24 or newer** and **npm** (included with Node.js).

Check that they are installed:

```bash
node --version
npm --version
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

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm start
   ```

   The app opens at [http://localhost:5173](http://localhost:5173). The page reloads when you edit files.

## Desktop app (Electron)

The same UI runs as a desktop app via Electron. In Electron mode the app uses hash-based routing (`HashRouter`) so navigation works from the `file://` protocol.

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

The desktop app accepts `.json` and `.jwk` files opened from the file manager or passed on the command line. When a file is sent to the app, a dialog asks whether to **import an encrypted message** or **sign in with a private key**.

After installing the `.deb` package from `release/`, right-click a `.json` or `.jwk` file and choose **Open With → Encrypt**. If Encrypt is not listed, use **Open With Other Application** once; later opens will show it in the menu.

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

## Other commands

| Command                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| `npm test`                 | Run tests in watch mode                       |
| `npm run build`            | Production web build to `dist/`               |
| `npm run build:pages`      | Build for GitHub Pages (`dist/` + `404.html`) |
| `npm run preview`          | Preview the production web build              |
| `npm run electron:dev`     | Electron dev server with hot reload           |
| `npm run electron:preview` | Build and run the Electron app locally        |
| `npm run electron:run`     | Run Electron from existing `dist/` build      |
| `npm run electron:build`   | Package desktop installers to `release/`      |
| `npm run lint`             | Check lint and formatting (ESLint + Prettier) |
| `npm run lint:fix`         | Auto-fix lint and formatting issues           |
| `npm run format`           | Format all files with Prettier                |
| `npm run format:check`     | Check formatting without writing changes      |

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
