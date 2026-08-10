import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repoRoot = path.join(projectRoot, '../..');

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.electron') });

/** @param {string[]} forwardedArgs */
export function runElectron(forwardedArgs = []) {
  const args = ['.'];
  if (process.platform === 'linux') {
    args.push('--no-sandbox');
  }
  args.push(...forwardedArgs);

  const child = spawn(electronPath, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: projectRoot,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });
}
