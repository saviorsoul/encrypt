import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';
import { subresourceIntegrityPlugin } from './vite/subresourceIntegrityPlugin.ts';

const repoRoot = path.resolve(__dirname, '../../..');

export default defineConfig(({ command }) => {
  const isGithubPages =
    command === 'build' && process.env.GITHUB_PAGES === 'true';
  const isDevServer = command === 'serve';

  return {
    envDir: repoRoot,
    plugins: [
      react(),
      contentSecurityPolicyPlugin(isDevServer),
      subresourceIntegrityPlugin({ enabled: true }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@electron/deepLinks.js': path.resolve(
          __dirname,
          'vite/electronDeepLinksStub.js',
        ),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      globals: true,
      exclude: configDefaults.exclude,
    },
    base: isGithubPages ? '/encrypt/' : '/',
  };
});
