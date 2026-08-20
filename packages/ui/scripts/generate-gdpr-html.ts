import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGdprPageHtml } from '../src/content/renderGdprHtml.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

const targets = [
  path.join(repoRoot, 'apps/feednt/public/gdpr.html'),
  path.join(repoRoot, 'apps/feed-lab/public/gdpr.html'),
];

const html = renderGdprPageHtml();

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, target)}`);
}
