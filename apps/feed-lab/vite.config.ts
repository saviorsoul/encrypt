import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../..');
const apiProxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';

  return {
    // GCS static hosting: relative asset URLs (./assets/...) from bucket root index.html.
    base: './',
    envDir: repoRoot,
    plugins: [
      react(),
      contentSecurityPolicyPlugin({
        isDevServer,
        apiUrl: process.env.VITE_API_URL,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../web/src'),
        '@lab': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 5174,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
