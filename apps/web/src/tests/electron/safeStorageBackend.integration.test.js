import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BASIC_TEXT_STORAGE_BACKEND } from '../../../electron/safeStoragePrivateKey.js';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const probeScript = path.join(webRoot, 'scripts/probe-safe-storage-backend.mjs');

/**
 * @param {string[]} extraArgs
 */
function probeSafeStorageBackend(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const args = [probeScript];
    if (process.platform === 'linux') {
      args.push('--no-sandbox');
    }
    args.push(...extraArgs);

    const child = spawn(electronPath, args, {
      cwd: webRoot,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Electron probe exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
        return;
      }

      const line = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .at(-1);
      if (!line) {
        reject(new Error(`Electron probe produced no output\nstderr: ${stderr}`));
        return;
      }

      resolve(JSON.parse(line));
    });
  });
}

describe('safeStorage backend integration', () => {
  it.skipIf(process.platform !== 'linux')(
    'reports basic_text when Electron is forced to --password-store=basic',
    async () => {
      const result = await probeSafeStorageBackend(['--password-store=basic']);

      expect(result.hasGetter).toBe(true);
      expect(result.backend).toBe(BASIC_TEXT_STORAGE_BACKEND);
    },
    30_000,
  );
});
