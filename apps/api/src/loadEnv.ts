import path from 'node:path';
import dotenv from 'dotenv';
import { findMonorepoRoot } from './lib/monorepoRoot.js';

const repoRoot = findMonorepoRoot(import.meta.dirname);

dotenv.config({ path: path.join(repoRoot, '.env') });
