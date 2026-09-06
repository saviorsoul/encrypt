import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { docsStaticPlugin } from './vite-plugin-docs-static.ts';

const DEFAULT_SITE_URL = 'https://feednt.com';
const DOCS_ROOT = path.resolve(__dirname, 'public/docs');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const siteUrl = env.VITE_SITE_URL || DEFAULT_SITE_URL;

  return {
    base: './',
    plugins: [
      docsStaticPlugin(DOCS_ROOT),
      react(),
      tailwindcss(),
      {
        name: 'html-site-meta',
        transformIndexHtml(html) {
          return html.replaceAll('%SITE_URL%', siteUrl);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 5175,
    },
  };
});
