import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderGdprPageHtml,
  renderGdprPageScript,
} from '../src/content/renderGdprHtml.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

const targetDirs = [
  path.join(repoRoot, 'apps/feednt/public'),
  path.join(repoRoot, 'apps/feed-lab/public'),
];

const html = renderGdprPageHtml();
const script = renderGdprPageScript();

for (const targetDir of targetDirs) {
  fs.mkdirSync(targetDir, { recursive: true });

  const htmlPath = path.join(targetDir, 'gdpr.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, htmlPath)}`);

  const scriptPath = path.join(targetDir, 'gdpr.js');
  fs.writeFileSync(scriptPath, script, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, scriptPath)}`);
}
