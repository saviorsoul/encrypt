import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';
  const env = loadEnv(command, repoRoot, '');
  const apiProxyTarget = env.VITE_PROXY_TARGET ?? 'http://localhost:3000';

  return {
    base: './',
    envDir: repoRoot,
    plugins: [
      react(),
      contentSecurityPolicyPlugin({
        isDevServer,
        apiUrl: env.VITE_API_URL,
      }),
    ],
    resolve: {
      alias: {
        '@feednt': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: true,
      port: 5180,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
