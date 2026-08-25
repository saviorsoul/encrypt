import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { feedntNativeBuildEnvPlugin } from '../vite/feedntNativeBuildEnvPlugin.ts';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../../..');
const feedntRoot = path.resolve(__dirname, '..');

export default defineConfig(({ command, mode }) => {
  const isDevServer = command === 'serve';
  const env = loadEnv(mode, repoRoot, '');
  const apiProxyTarget = env.VITE_PROXY_TARGET ?? 'http://localhost:3000';

  return {
    root: __dirname,
    base: './',
    publicDir: path.resolve(feedntRoot, 'public'),
    envDir: repoRoot,
    define: {
      'import.meta.env.VITE_ELECTRON': JSON.stringify('1'),
      'import.meta.env.VITE_FEEDNT_HASH_ROUTER': JSON.stringify('1'),
    },
    plugins: [
      react(),
      contentSecurityPolicyPlugin({
        isDevServer,
        apiUrl: env.VITE_API_URL,
      }),
      feedntNativeBuildEnvPlugin({
        apiUrl: env.VITE_API_URL,
        electronBuildEnvPath: path.resolve(
          __dirname,
          'electron/build-env.json',
        ),
      }),
    ],
    resolve: {
      alias: [
        {
          find: '@feednt/runtime',
          replacement: path.resolve(__dirname, 'src/platform.ts'),
        },
        { find: '@feednt', replacement: path.resolve(feedntRoot, 'src') },
      ],
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
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
