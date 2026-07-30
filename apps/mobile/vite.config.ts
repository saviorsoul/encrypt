import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../..');
const webRoot = path.resolve(__dirname, '../web');
const webSrc = path.resolve(webRoot, 'src');

export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';

  return {
    base: './',
    define: {
      'import.meta.env.VITE_CAPACITOR': JSON.stringify('1'),
    },
    envDir: repoRoot,
    publicDir: path.resolve(webRoot, 'public'),
    plugins: [react(), contentSecurityPolicyPlugin(isDevServer)],
    resolve: {
      alias: {
        '@': webSrc,
        '@electron': path.resolve(webRoot, 'electron'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: true,
      port: 5175,
    },
  };
});
