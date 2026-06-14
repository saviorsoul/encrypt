import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const isElectron = mode === 'electron';
  const isGithubPages =
    command === 'build' && process.env.GITHUB_PAGES === 'true';

  return {
    plugins: [react()],
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
