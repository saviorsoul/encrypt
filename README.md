# social-fe

Social app run locally. Built with React.

## Prerequisites

You need **Node.js 18 or newer** (LTS recommended) and **npm** (included with Node.js).

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

## Getting started

1. Clone the repository and go into the project folder:

   ```bash
   git clone <repository-url>
   cd social-fe
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

## Other commands

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm test`             | Run tests in watch mode                          |
| `npm run build`        | Production build to `dist/`                      |
| `npm run preview`      | Preview the production build                     |
| `npm run lint`         | Check lint and formatting (ESLint + Prettier)    |
| `npm run lint:fix`     | Auto-fix lint and formatting issues              |
| `npm run format`       | Format all files with Prettier                   |
| `npm run format:check` | Check formatting without writing changes         |

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
