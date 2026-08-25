import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectRoot, '../../..');

function loadEnvFile(fileName) {
  try {
    const content = readFileSync(path.join(repoRoot, fileName), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }
      process.env[key] = trimmed.slice(separator + 1).trim();
    }
  } catch {
    // optional env files
  }
}

loadEnvFile('.env');

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
    cwd: path.join(projectRoot, '..'),
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });
}
