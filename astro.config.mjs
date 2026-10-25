import { defineConfig } from 'astro/config';

// GitHub Pages project site, not the user root domain.
export default defineConfig({
  site: 'https://corexlyth.github.io',
  base: '/corexlyth-site',
  output: 'static',
});
