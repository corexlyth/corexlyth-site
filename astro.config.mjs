import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { literalHtml } from './scripts/markdown-safety.mjs';

export default defineConfig({
  site: 'https://corexlyth.github.io',
  base: '/corexlyth-site',
  output: 'static',
  markdown: { processor: unified({ remarkPlugins: [literalHtml], rehypePlugins: [[rehypeSanitize, { ...defaultSchema, clobberPrefix: '' }]] }) },
  integrations: [sitemap({
    filter: (page) => !page.endsWith('/404.html') && !page.includes('/ara/') && !page.includes('/hesap/'),
  })],
});
