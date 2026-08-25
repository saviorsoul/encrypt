import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

type FeedntNativeBuildEnvPluginOptions = {
  apiUrl?: string;
  /** Capacitor reads this after `vite build` to pick androidScheme. */
  buildEnvJsonPath?: string;
  /** Electron main-process CSP reads this when packaged. */
  electronBuildEnvPath?: string;
};

function writeFileEnsuringDir(filePath: string, contents: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

export function feedntNativeBuildEnvPlugin(
  options: FeedntNativeBuildEnvPluginOptions,
): Plugin {
  const apiUrl = options.apiUrl?.trim() ?? '';

  return {
    name: 'feednt-native-build-env',
    apply: 'build',
    closeBundle() {
      const payload = `${JSON.stringify({ apiUrl }, null, 2)}\n`;

      if (options.buildEnvJsonPath) {
        writeFileEnsuringDir(options.buildEnvJsonPath, payload);
      }

      if (options.electronBuildEnvPath) {
        writeFileEnsuringDir(options.electronBuildEnvPath, payload);
      }
    },
  };
}
