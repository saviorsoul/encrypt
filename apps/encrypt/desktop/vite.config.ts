import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from '../web/vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../../..');
const encryptRoot = path.resolve(__dirname, '../web');
const encryptSrc = path.resolve(encryptRoot, 'src');

export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';

  return {
    root: __dirname,
    base: './',
    publicDir: path.resolve(encryptRoot, 'public'),
    envDir: repoRoot,
    define: {
      'import.meta.env.VITE_ELECTRON': JSON.stringify('1'),
    },
    plugins: [react(), contentSecurityPolicyPlugin(isDevServer)],
    resolve: {
      alias: {
        '@': encryptSrc,
        '@electron': path.resolve(__dirname, 'electron'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    test: {
      environment: 'node',
      globals: true,
      exclude: configDefaults.exclude,
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
