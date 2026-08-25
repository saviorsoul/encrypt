import path from 'node:path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { feedntNativeBuildEnvPlugin } from '../vite/feedntNativeBuildEnvPlugin.ts';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../../..');
const feedntRoot = path.resolve(__dirname, '..');

export default defineConfig(({ command, mode }) => {
  const isDevServer = command === 'serve';
  const env = loadEnv(mode, repoRoot, '');

  const plugins: PluginOption[] = [
    react(),
    {
      name: 'feednt-mobile-favicon-href',
      transformIndexHtml(html: string, ctx: { server?: unknown }) {
        const href = ctx.server ? '/favicon.svg' : './favicon.svg';
        return html.replace('%BASE_URL%favicon.svg', href);
      },
    },
    contentSecurityPolicyPlugin({
      isDevServer,
      apiUrl: env.VITE_API_URL,
    }),
    feedntNativeBuildEnvPlugin({
      apiUrl: env.VITE_API_URL,
      buildEnvJsonPath: path.resolve(feedntRoot, 'dist/feednt-build-env.json'),
    }),
  ];

  return {
    root: __dirname,
    base: './',
    publicDir: path.resolve(feedntRoot, 'public'),
    define: {
      'import.meta.env.VITE_CAPACITOR': JSON.stringify('1'),
      'import.meta.env.VITE_FEEDNT_HASH_ROUTER': JSON.stringify('1'),
    },
    envDir: repoRoot,
    plugins,
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
      outDir: path.resolve(feedntRoot, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    server: {
      host: true,
      port: 5181,
    },
  };
});
