import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_SITE_URL = 'https://feednt.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const siteUrl = env.VITE_SITE_URL || DEFAULT_SITE_URL;

  return {
    base: './',
    plugins: [
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
