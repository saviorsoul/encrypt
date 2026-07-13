import path from 'node:path';
import dotenv from 'dotenv';
import { findMonorepoRoot } from './lib/monorepoRoot.js';

const repoRoot = findMonorepoRoot(import.meta.dirname);

// Cloud Run injects secrets via env; skip .env in production to avoid accidental overrides.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(repoRoot, '.env') });
}
