import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const webIcons = path.resolve(root, '../web/electron/icons');

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.mkdirSync(dist, { recursive: true });
copyFile(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));
copyFile(
  path.join(root, 'src/options/options.html'),
  path.join(dist, 'options/options.html'),
);
copyFile(
  path.join(root, 'src/options/options.css'),
  path.join(dist, 'options/options.css'),
);
copyFile(
  path.join(root, 'src/open/open.html'),
  path.join(dist, 'open/open.html'),
);

const iconMap = [
  ['16x16.png', 'icon16.png'],
  ['32x32.png', 'icon32.png'],
  ['48x48.png', 'icon48.png'],
  ['128x128.png', 'icon128.png'],
];

for (const [sourceName, destName] of iconMap) {
  copyFile(
    path.join(webIcons, sourceName),
    path.join(dist, 'icons', destName),
  );
}

console.log('Copied extension static assets to dist/');
