import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';
import { subresourceIntegrityPlugin } from './vite/subresourceIntegrityPlugin.ts';

export default defineConfig(({ command, mode }) => {
  const isElectron = mode === 'electron';
  const isGithubPages =
    command === 'build' && process.env.GITHUB_PAGES === 'true';
  const isDevServer = command === 'serve';

  return {
    plugins: [
      react(),
      contentSecurityPolicyPlugin(isDevServer),
      subresourceIntegrityPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      globals: true,
    },
    base: isGithubPages ? '/encrypt/' : isElectron ? './' : '/',
  };
});
