import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function isMonorepoRoot(dir: string): boolean {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      workspaces?: unknown;
    };
    return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
  } catch {
    return false;
  }
}

/** Walk up from startDir until the npm workspaces root package.json is found. */
export function findMonorepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);

  while (true) {
    if (isMonorepoRoot(dir)) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Monorepo root not found (no package.json with workspaces).',
      );
    }
    dir = parent;
  }
}
