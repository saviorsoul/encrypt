import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Gitignored seed keys beside the api package (`apps/api/keys`). */
export const E2E_API_KEYS_DIR = fileURLToPath(
  new URL('../../keys', import.meta.url),
);

export const E2E_INVITER_PRIVATE_KEY_PATH = path.join(
  E2E_API_KEYS_DIR,
  'e2e-inviter-private-key.json',
);
