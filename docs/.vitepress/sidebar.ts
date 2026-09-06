import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { DefaultTheme } from 'vitepress';

const DOCS_ROOT = join(import.meta.dirname, '..');

const NUMERIC_PREFIX_FOLDERS = new Set(['adr', 'rfc']);
const EXCLUDED_DIRS = new Set(['.vitepress', 'public']);

function formatGroupName(name: string): string {
  if (name === 'adr') return 'Architecture Decision Records';
  if (name === 'rfc') return 'RFCs';
  if (name === 'user-stories') return 'User Stories';
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sortMdFiles(a: string, b: string, folderKey: string): number {
  const nameA = basename(a, '.md');
  const nameB = basename(b, '.md');

  if (nameA === 'README') return -1;
  if (nameB === 'README') return 1;

  if (NUMERIC_PREFIX_FOLDERS.has(folderKey)) {
    const numA = Number.parseInt(nameA.slice(0, 4), 10) || 0;
    const numB = Number.parseInt(nameB.slice(0, 4), 10) || 0;
    if (numA !== numB) return numA - numB;
  }

  return nameA.localeCompare(nameB, undefined, { numeric: true });
}

function fileToLink(filePath: string): string {
  const rel = relative(DOCS_ROOT, filePath).replace(/\\/g, '/');
  const withoutExt = rel.replace(/\.md$/, '');

  if (withoutExt === 'index') return '/';
  if (withoutExt.endsWith('/README')) {
    return `/${withoutExt}`;
  }

  return `/${withoutExt}`;
}

function readTitleFromFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf8');
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return basename(filePath, '.md');
}

function buildGroupItems(
  dirPath: string,
  folderKey: string,
  flattenSubdirs = false,
): DefaultTheme.SidebarItem[] {
  const entries = readdirSync(dirPath);
  const items: DefaultTheme.SidebarItem[] = [];
  const mdFiles: string[] = [];
  const subdirs: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    if (statSync(fullPath).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) {
        subdirs.push(entry);
      }
    } else if (entry.endsWith('.md') && entry !== 'index.md') {
      mdFiles.push(entry);
    }
  }

  mdFiles.sort((a, b) => sortMdFiles(a, b, folderKey));
  for (const file of mdFiles) {
    const fullPath = join(dirPath, file);
    items.push({
      text: readTitleFromFile(fullPath),
      link: fileToLink(fullPath),
    });
  }

  subdirs.sort();
  for (const subdir of subdirs) {
    if (flattenSubdirs) {
      items.push(
        ...buildGroupItems(join(dirPath, subdir), subdir, flattenSubdirs),
      );
    } else {
      items.push({
        text: formatGroupName(subdir),
        collapsed: true,
        items: buildGroupItems(join(dirPath, subdir), subdir, flattenSubdirs),
      });
    }
  }

  return items;
}

export function generateSidebar(): DefaultTheme.SidebarItem[] {
  const topLevelDirs = readdirSync(DOCS_ROOT)
    .filter((name) => {
      const fullPath = join(DOCS_ROOT, name);
      return statSync(fullPath).isDirectory() && !EXCLUDED_DIRS.has(name);
    })
    .sort();

  return topLevelDirs.map((dirName) => ({
    text: formatGroupName(dirName),
    collapsed: true,
    items: buildGroupItems(
      join(DOCS_ROOT, dirName),
      dirName,
      dirName === 'user-stories',
    ),
  }));
}
