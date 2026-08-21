import path from 'node:path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicyPlugin } from './vite/contentSecurityPolicyPlugin.ts';

const repoRoot = path.resolve(__dirname, '../..');

function parseDevHostnames(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return ['localhost'];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default defineConfig(({ command, mode }) => {
  const isDevServer = command === 'serve';
  const env = loadEnv(mode, repoRoot, '');
  const useBrowserRouter =
    isDevServer ||
    env.VITE_BROWSER_ROUTER === 'true' ||
    env.VITE_BROWSER_ROUTER === '1';
  const devHttps =
    env.FEED_LAB_DEV_HTTPS === 'true' || env.FEED_LAB_DEV_HTTPS === '1';
  const apiProxyTarget = env.VITE_PROXY_TARGET ?? 'http://localhost:3000';
  const devHostnames = parseDevHostnames(env.VITE_FEED_LAB_DEV_HOSTNAME);
  const assetBase = useBrowserRouter ? '/' : './';

  const plugins: PluginOption[] = [
    react(),
    {
      name: 'feed-lab-favicon-href',
      transformIndexHtml(html: string) {
        const href = assetBase === '/' ? '/favicon.svg' : './favicon.svg';
        return html.replace('%BASE_URL%favicon.svg', href);
      },
    },
    contentSecurityPolicyPlugin({
      isDevServer,
      apiUrl: env.VITE_API_URL,
    }),
  ];

  if (isDevServer && devHttps) {
    plugins.unshift(
      basicSsl({
        name: 'feed-lab-dev',
        domains: devHostnames,
      }),
    );
  }

  return {
    base: assetBase,
    envDir: repoRoot,
    plugins,
    resolve: {
      alias: {
        '@lab': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 5174,
      ...(devHttps ? { https: {} } : {}),
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
