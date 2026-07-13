import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(__dirname, '../..');
const apiProxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig(({ mode }) => ({
  // GCS: index.html lives at storage.googleapis.com/BUCKET/index.html — use relative asset paths.
  base: mode === 'production' ? './' : '/',
  envDir: repoRoot,
  plugins: [react()],
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
}));
