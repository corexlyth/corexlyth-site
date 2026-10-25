import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://corexlyth.github.io',
  base: '/corexlyth-site',
  output: 'static',
  integrations: [sitemap({
    filter: (page) => !page.endsWith('/404.html') && !page.includes('/ara/') && !page.includes('/hesap/'),
  })],
});
