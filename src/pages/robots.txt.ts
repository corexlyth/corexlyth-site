import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL('/corexlyth-site/sitemap-index.xml', site ?? 'https://corexlyth.github.io');
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemapURL.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
