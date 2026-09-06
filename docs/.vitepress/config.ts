import { defineConfig } from 'vitepress';
import { generateSidebar } from './sidebar.ts';

export default defineConfig({
  title: 'Feednt Docs',
  description: 'Architecture decisions, RFCs, and user stories',
  base: '/docs/',
  srcExclude: ['**/.vitepress/**'],
  ignoreDeadLinks: true,
  cleanUrls: false,
  sitemap: {
    hostname: 'https://feednt.com',
    transformItems(items) {
      return items.map((item) => {
        if (item.url === '/') {
          return { ...item, url: '/docs/' };
        }

        const path = item.url.startsWith('/') ? item.url : `/${item.url}`;
        const withBase = `/docs${path}`;
        const withHtml = withBase.endsWith('.html')
          ? withBase
          : `${withBase}.html`;
        return { ...item, url: withHtml };
      });
    },
  },
  themeConfig: {
    nav: [{ text: '← feednt.com', link: 'https://feednt.com' }],
    sidebar: generateSidebar(),
    search: { provider: 'local' },
  },
});
