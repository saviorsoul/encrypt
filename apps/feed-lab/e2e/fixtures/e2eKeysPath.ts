import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Local e2e key material (gitignored). */
export const E2E_KEYS_DIR = fileURLToPath(new URL('../keys', import.meta.url));

export const REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH = path.join(
  E2E_KEYS_DIR,
  'registered-ephemeral-private-key.json',
);
