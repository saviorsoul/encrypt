import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDist = join(rootDir, 'docs', '.vitepress', 'dist');
const landingPublicDocs = join(rootDir, 'apps', 'landing-page', 'public', 'docs');

rmSync(landingPublicDocs, { recursive: true, force: true });
cpSync(docsDist, landingPublicDocs, { recursive: true });

console.log(`Copied docs build to ${landingPublicDocs}`);
