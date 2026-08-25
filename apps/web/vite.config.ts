import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';
import { subresourceIntegrityPlugin } from './vite/subresourceIntegrityPlugin.ts';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ command, mode }) => {
  const isElectron = mode === 'electron';
  const isGithubPages =
    command === 'build' && process.env.GITHUB_PAGES === 'true';
  const isDevServer = command === 'serve';

  return {
    envDir: repoRoot,
    ...(isElectron
      ? { define: { 'import.meta.env.VITE_ELECTRON': JSON.stringify('1') } }
      : {}),
    plugins: [
      react(),
      contentSecurityPolicyPlugin(isDevServer),
      subresourceIntegrityPlugin({ enabled: !isElectron }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@electron': path.resolve(__dirname, 'electron'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      globals: true,
      exclude: configDefaults.exclude,
    },
    base: isGithubPages ? '/encrypt/' : isElectron ? './' : '/',
  };
});
